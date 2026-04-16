import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handleRuntimeSubmit } from '../../../lib/submitFormRuntime';

function summarizeEnv(env) {
  let envKeyCount = 0;

  try {
    envKeyCount = env ? Object.keys(env).length : 0;
  } catch {
    envKeyCount = -1;
  }

  return {
    hasEnv: Boolean(env),
    envKeyCount,
    hasSubmissionsDb: Boolean(env?.SUBMISSIONS_DB),
    hasFormUploads: Boolean(env?.FORM_UPLOADS),
    hasBaseUrl: typeof env?.BASE_URL === 'string',
    hasAssetsPrefix: typeof env?.ASSETS_PREFIX === 'string',
    hasNextPublicBaseUrl: typeof env?.NEXT_PUBLIC_BASE_URL === 'string',
    hasNextPublicAssetsPrefix: typeof env?.NEXT_PUBLIC_ASSETS_PREFIX === 'string',
  };
}

function methodNotAllowed() {
  return new Response(JSON.stringify({ message: 'Method not allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function POST(request) {
  let runtime = {};

  try {
    const context = getCloudflareContext();
    const env = context?.env;

    console.log('Submit route context diagnostics', {
      hasContext: Boolean(context),
      ...summarizeEnv(env),
    });

    runtime = { env };
  } catch {
    console.error('Submit route getCloudflareContext failed');
  }

  return handleRuntimeSubmit(request, runtime);
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
