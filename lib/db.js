import { getCloudflareEnv } from './cloudflareRuntime';

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

async function getDatabase(runtime = {}) {
  if (runtime.db) {
    return runtime.db;
  }

  const env = await getCloudflareEnv(runtime);
  const db = env?.SUBMISSIONS_DB;

  if (!db) {
    throw new Error('SUBMISSIONS_DB binding is required. This app is configured for Webflow Cloud SQLite only.');
  }

  return db;
}

async function getSubmissionById(id, runtime = {}) {
  const db = await getDatabase(runtime);
  const row = await db
    .prepare('SELECT * FROM submissions WHERE id = ? LIMIT 1')
    .bind(id)
    .first();

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
    const database = await getDatabase(runtime);
    const id = crypto.randomUUID();
    const createdAt = nowIso();

    await database.prepare(`
      INSERT INTO submissions (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      submissionType,
      appName,
      clientId,
      creatorEmail,
      serializeJson(formData),
      serializeJson(blobUrls),
      status,
      createdAt,
      createdAt
    ).run();

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
    const database = await getDatabase(runtime);

    await database.prepare(`
      INSERT INTO submissions (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
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
      updatedAt
    ).run();

    return getSubmissionById(id, runtime);
  },

  async updateSubmission(id, updates, runtime = {}) {
    const database = await getDatabase(runtime);
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
    ].filter(([_, value]) => value !== undefined);

    fields.push(['updated_at', updatedAt]);

    const assignments = fields.map(([column]) => `${column} = ?`).join(', ');
    const values = fields.map(([_, value]) => value);

    await database.prepare(`
      UPDATE submissions
      SET ${assignments}
      WHERE id = ?
    `).bind(...values, id).run();

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
    const database = await getDatabase(runtime);
    let query = 'SELECT * FROM submissions WHERE 1=1';
    const params = [];

    if (appName) {
      query += ' AND LOWER(app_name) LIKE LOWER(?)';
      params.push(`%${appName}%`);
    }

    if (clientId) {
      query += ' AND client_id = ?';
      params.push(clientId);
    }

    if (creatorEmail) {
      query += ' AND LOWER(creator_email) LIKE LOWER(?)';
      params.push(`%${creatorEmail}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (startDate) {
      query += ' AND datetime(created_at) >= datetime(?)';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND datetime(created_at) <= datetime(?)';
      params.push(endDate);
    }

    query += ' ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await database.prepare(query).bind(...params).all();
    return (result.results || []).map(normalizeSubmission);
  },

  async getFailedSubmissions(maxRetries = 3, runtime = {}) {
    const database = await getDatabase(runtime);
    const result = await database.prepare(`
      SELECT * FROM submissions
      WHERE status = 'webhook_failed'
        AND retry_count < ?
        AND (
          webhook_sent_at IS NULL
          OR datetime(webhook_sent_at) < datetime('now', '-15 minutes')
        )
      ORDER BY datetime(created_at) ASC
      LIMIT 10
    `).bind(maxRetries).all();

    return (result.results || []).map(normalizeSubmission);
  },

  async getSubmissionsForBlobCleanup(runtime = {}) {
    const database = await getDatabase(runtime);
    const result = await database.prepare(`
      SELECT id, blob_urls, blobs_cleaned_at, created_at
      FROM submissions
      WHERE status = 'webhook_success'
        AND blob_urls IS NOT NULL
        AND blobs_cleaned_at IS NULL
        AND datetime(created_at) < datetime('now', '-24 hours')
      LIMIT 100
    `).all();

    return (result.results || []).map(normalizeSubmission);
  },

  async getStats(days = 7, runtime = {}) {
    const database = await getDatabase(runtime);
    const result = await database.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        substr(created_at, 1, 10) as date
      FROM submissions
      WHERE datetime(created_at) >= datetime('now', ?)
      GROUP BY status, substr(created_at, 1, 10)
      ORDER BY date DESC, status
    `).bind(`-${days} days`).all();

    return result.results || [];
  },

  async findRecentDuplicate(clientId, submissionType, windowSeconds = 60, runtime = {}) {
    if (!clientId) {
      return null;
    }

    const cutoffTime = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const database = await getDatabase(runtime);
    const row = await database.prepare(`
      SELECT * FROM submissions
      WHERE client_id = ?
        AND submission_type = ?
        AND datetime(created_at) > datetime(?)
        AND status != 'webhook_failed'
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).bind(clientId, submissionType, cutoffTime).first();

    return normalizeSubmission(row) || null;
  }
};
