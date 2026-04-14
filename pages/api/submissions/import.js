import { db } from '../../../lib/db';
import { requireAdminApiToken } from '../../../lib/apiAuth';
import { copyRemoteFilesToUploads } from '../../../lib/blobStore';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(['processing', 'pending', 'webhook_success', 'webhook_failed']);

function coerceTimestamp(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return parsed.toISOString();
}

function coerceInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function normalizeImportedSubmission(payload) {
  const submission = payload?.submission && typeof payload.submission === 'object'
    ? payload.submission
    : payload;

  if (!submission || typeof submission !== 'object') {
    throw new Error('Submission payload is required');
  }

  if (!UUID_REGEX.test(submission.id || '')) {
    throw new Error('Submission ID must be a valid UUID');
  }

  if (!submission.submissionType) {
    throw new Error('submissionType is required');
  }

  if (!submission.appName) {
    throw new Error('appName is required');
  }

  const status = submission.status || 'processing';
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Unsupported submission status: ${status}`);
  }

  return {
    id: submission.id,
    submissionType: submission.submissionType,
    appName: submission.appName,
    clientId: submission.clientId || null,
    creatorEmail: submission.creatorEmail || null,
    formData: submission.formData && typeof submission.formData === 'object' ? submission.formData : {},
    sourceBlobUrls: Array.isArray(submission.blobUrls) ? submission.blobUrls.filter(Boolean) : [],
    blobsCleanedAt: coerceTimestamp(submission.blobsCleanedAt, null),
    status,
    airtableSubmissionId: submission.airtableSubmissionId || null,
    webhookResponse: submission.webhookResponse ?? null,
    webhookSentAt: coerceTimestamp(submission.webhookSentAt, null),
    errorMessage: submission.errorMessage || null,
    retryCount: coerceInteger(submission.retryCount, 0),
    createdAt: coerceTimestamp(submission.createdAt, new Date().toISOString()),
    updatedAt: coerceTimestamp(submission.updatedAt, coerceTimestamp(submission.createdAt, new Date().toISOString()))
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!await requireAdminApiToken(req, res)) {
    return;
  }

  try {
    const submission = normalizeImportedSubmission(req.body);
    const existingSubmission = await db.getSubmission(submission.id);

    if (existingSubmission) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Submission already exists in the target database',
        submissionId: existingSubmission.id
      });
    }

    let copiedFiles = [];
    let targetBlobUrls = [];

    if (!submission.blobsCleanedAt && submission.sourceBlobUrls.length > 0) {
      copiedFiles = await copyRemoteFilesToUploads(submission.sourceBlobUrls);
      targetBlobUrls = copiedFiles.map((file) => file.url);
    }

    const importedSubmission = await db.insertImportedSubmission({
      id: submission.id,
      submissionType: submission.submissionType,
      appName: submission.appName,
      clientId: submission.clientId,
      creatorEmail: submission.creatorEmail,
      formData: submission.formData,
      blobUrls: targetBlobUrls,
      blobsCleanedAt: submission.blobsCleanedAt,
      status: submission.status,
      airtableSubmissionId: submission.airtableSubmissionId,
      webhookResponse: submission.webhookResponse,
      webhookSentAt: submission.webhookSentAt,
      errorMessage: submission.errorMessage,
      retryCount: submission.retryCount,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt
    });

    return res.status(201).json({
      success: true,
      imported: true,
      submissionId: importedSubmission.id,
      copiedBlobCount: copiedFiles.length,
      blobsSkippedBecauseCleaned: submission.blobsCleanedAt !== null,
      blobUrls: importedSubmission.blob_urls
    });
  } catch (error) {
    console.error('Submission import error:', error);

    return res.status(400).json({
      success: false,
      message: 'Failed to import submission',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
