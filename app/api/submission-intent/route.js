import { handleRuntimeSubmissionIntent } from '../../../lib/submissionIntentRuntime';
import { sanitizeIncomingRequest } from '../../../lib/requestHeaderSanitizer';

export async function POST(request) {
  return handleRuntimeSubmissionIntent(sanitizeIncomingRequest(request));
}
