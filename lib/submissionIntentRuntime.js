import { db } from './db';
import { getFieldValue } from './submissionPayload';

const CLIENT_ID_PATTERN = /^[a-f0-9]{64}$/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function assertPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export async function createSubmissionIntent(fields, runtime = {}, database = db) {
  if (!assertPlainObject(fields)) {
    return {
      response: jsonResponse({
        success: false,
        message: 'Invalid submission payload',
        error: 'Expected a JSON object of submission fields.'
      }, 400)
    };
  }

  const clientId = getFieldValue(fields.clientId);
  const submissionType = getFieldValue(fields.submissionType);

  if (!submissionType) {
    return {
      response: jsonResponse({
        success: false,
        message: 'Submission type is required',
        error: 'Choose whether this is a new app or an update before submitting.'
      }, 400)
    };
  }

  if (!clientId) {
    return {
      response: jsonResponse({
        success: false,
        message: 'Client ID is required',
        error: 'Client ID is required before saving submission details.'
      }, 400)
    };
  }

  if (clientId && !CLIENT_ID_PATTERN.test(clientId)) {
    return {
      response: jsonResponse({
        success: false,
        message: 'Invalid Client ID format',
        error: 'Client ID must be a 64-character hexadecimal string.'
      }, 400)
    };
  }

  const submission = await database.createSubmission({
    submissionType,
    appName: getFieldValue(fields.appName) || 'Unknown',
    clientId: clientId || null,
    creatorEmail: getFieldValue(fields.creatorContactEmail) || null,
    formData: fields,
    blobUrls: [],
    status: 'processing'
  }, runtime);

  return {
    submission,
    response: jsonResponse({
      success: true,
      message: 'Submission details saved',
      submissionId: submission.id
    })
  };
}

export async function handleRuntimeSubmissionIntent(request, runtime = {}, database = db) {
  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Method not allowed' }, 405);
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return jsonResponse({
        success: false,
        message: 'Unsupported content type',
        error: 'Submission details must be sent as JSON.'
      }, 415);
    }

    const body = await request.json();
    const fields = assertPlainObject(body?.fields) ? body.fields : body;
    const { response } = await createSubmissionIntent(fields, runtime, database);

    return response;
  } catch (error) {
    return jsonResponse({
      success: false,
      message: 'Failed to save submission details',
      error: error.message
    }, 500);
  }
}
