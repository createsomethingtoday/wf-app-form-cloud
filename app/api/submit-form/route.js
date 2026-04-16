import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handleRuntimeSubmit } from '../../../lib/submitFormRuntime';

function methodNotAllowed() {
  return new Response(JSON.stringify({ message: 'Method not allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function POST(request) {
  try {
    const context = getCloudflareContext();
    return handleRuntimeSubmit(request, { env: context?.env });
  } catch {
    return handleRuntimeSubmit(request);
  }
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}
