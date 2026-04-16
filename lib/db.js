import { d1Query, d1First } from './d1Client';

function nowIso() {
  return new Date().toISOString();
}

function serializeJson(value) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeSubmission(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    form_data: parseJson(row.form_data, {}),
    blob_urls: parseJson(row.blob_urls, []),
    webhook_response: parseJson(row.webhook_response, null),
    retry_count: row.retry_count ?? 0,
  };
}

async function getSubmissionById(id, runtime = {}) {
  const row = await d1First(
    'SELECT * FROM submissions WHERE id = ? LIMIT 1',
    [id],
    runtime,
  );

  return normalizeSubmission(row);
}

export const db = {
  async createSubmission({
    submissionType,
    appName,
    clientId,
    creatorEmail,
    formData,
    blobUrls = [],
    status = 'processing'
  }, runtime = {}) {
    const id = crypto.randomUUID();
    const createdAt = nowIso();

    await d1Query(
      `INSERT INTO submissions (
        id,
        submission_type,
        app_name,
        client_id,
        creator_email,
        form_data,
        blob_urls,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        submissionType,
        appName,
        clientId,
        creatorEmail,
        serializeJson(formData),
        serializeJson(blobUrls),
        status,
        createdAt,
        createdAt,
      ],
      runtime,
    );

    return getSubmissionById(id, runtime);
  },

  async insertImportedSubmission({
    id,
    submissionType,
    appName,
    clientId,
    creatorEmail,
    formData,
    blobUrls = [],
    blobsCleanedAt = null,
    status = 'processing',
    airtableSubmissionId = null,
    webhookResponse = null,
    webhookSentAt = null,
    errorMessage = null,
    retryCount = 0,
    createdAt,
    updatedAt
  }, runtime = {}) {
    await d1Query(
      `INSERT INTO submissions (
        id,
        submission_type,
        app_name,
        client_id,
        creator_email,
        form_data,
        blob_urls,
        blobs_cleaned_at,
        status,
        airtable_submission_id,
        webhook_response,
        webhook_sent_at,
        error_message,
        retry_count,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        submissionType,
        appName,
        clientId,
        creatorEmail,
        serializeJson(formData),
        serializeJson(blobUrls),
        blobsCleanedAt,
        status,
        airtableSubmissionId,
        serializeJson(webhookResponse),
        webhookSentAt,
        errorMessage,
        retryCount,
        createdAt,
        updatedAt,
      ],
      runtime,
    );

    return getSubmissionById(id, runtime);
  },

  async updateSubmission(id, updates, runtime = {}) {
    const updatedAt = nowIso();

    const fields = [
      ['status', updates.status],
      ['blob_urls', updates.blobUrls !== undefined ? serializeJson(updates.blobUrls) : undefined],
      ['airtable_submission_id', updates.airtableSubmissionId],
      ['webhook_response', updates.webhookResponse !== undefined ? serializeJson(updates.webhookResponse) : undefined],
      ['error_message', updates.errorMessage],
      ['retry_count', updates.retryCount],
      ['webhook_sent_at', updates.webhookSentAt],
      ['blobs_cleaned_at', updates.blobsCleanedAt],
    ].filter(([, value]) => value !== undefined);

    fields.push(['updated_at', updatedAt]);

    const assignments = fields.map(([column]) => `${column} = ?`).join(', ');
    const values = fields.map(([, value]) => value);

    await d1Query(
      `UPDATE submissions SET ${assignments} WHERE id = ?`,
      [...values, id],
      runtime,
    );

    return getSubmissionById(id, runtime);
  },

  async getSubmission(id, runtime = {}) {
    return getSubmissionById(id, runtime);
  },

  async searchSubmissions({
    appName,
    clientId,
    creatorEmail,
    status,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  }, runtime = {}) {
    let sql = 'SELECT * FROM submissions WHERE 1=1';
    const params = [];

    if (appName) {
      sql += ' AND LOWER(app_name) LIKE LOWER(?)';
      params.push(`%${appName}%`);
    }

    if (clientId) {
      sql += ' AND client_id = ?';
      params.push(clientId);
    }

    if (creatorEmail) {
      sql += ' AND LOWER(creator_email) LIKE LOWER(?)';
      params.push(`%${creatorEmail}%`);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (startDate) {
      sql += ' AND datetime(created_at) >= datetime(?)';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND datetime(created_at) <= datetime(?)';
      params.push(endDate);
    }

    sql += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { rows } = await d1Query(sql, params, runtime);
    return rows.map(normalizeSubmission);
  },

  async getFailedSubmissions(maxRetries = 3, runtime = {}) {
    const { rows } = await d1Query(
      `SELECT * FROM submissions
        WHERE status = 'webhook_failed'
          AND retry_count < ?
          AND (
            webhook_sent_at IS NULL
            OR datetime(webhook_sent_at) < datetime('now', '-15 minutes')
          )
        ORDER BY datetime(created_at) ASC
        LIMIT 10`,
      [maxRetries],
      runtime,
    );

    return rows.map(normalizeSubmission);
  },

  async getSubmissionsForBlobCleanup(runtime = {}) {
    const { rows } = await d1Query(
      `SELECT id, blob_urls, blobs_cleaned_at, created_at
        FROM submissions
        WHERE status = 'webhook_success'
          AND blob_urls IS NOT NULL
          AND blobs_cleaned_at IS NULL
          AND datetime(created_at) < datetime('now', '-24 hours')
        LIMIT 100`,
      [],
      runtime,
    );

    return rows.map(normalizeSubmission);
  },

  async getStats(days = 7, runtime = {}) {
    const { rows } = await d1Query(
      `SELECT
          status,
          COUNT(*) as count,
          substr(created_at, 1, 10) as date
        FROM submissions
        WHERE datetime(created_at) >= datetime('now', ?)
        GROUP BY status, substr(created_at, 1, 10)
        ORDER BY date DESC, status`,
      [`-${days} days`],
      runtime,
    );

    return rows;
  },

  async findRecentDuplicate(clientId, submissionType, windowSeconds = 60, runtime = {}) {
    if (!clientId) {
      return null;
    }

    const cutoffTime = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const row = await d1First(
      `SELECT * FROM submissions
        WHERE client_id = ?
          AND submission_type = ?
          AND datetime(created_at) > datetime(?)
          AND status != 'webhook_failed'
        ORDER BY datetime(created_at) DESC
        LIMIT 1`,
      [clientId, submissionType, cutoffTime],
      runtime,
    );

    return normalizeSubmission(row);
  }
};
