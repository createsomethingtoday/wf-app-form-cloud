import { getUploadedObject } from '../../../../lib/blobStore';

export const runtime = 'edge';

function buildObjectResponse(object, includeBody = true) {
  const headers = new Headers();

  if (typeof object.writeHttpMetadata === 'function') {
    object.writeHttpMetadata(headers);
  }

  if (!headers.has('Content-Type') && object.httpMetadata?.contentType) {
    headers.set('Content-Type', object.httpMetadata.contentType);
  }

  if (object.size !== undefined) {
    headers.set('Content-Length', String(object.size));
  }

  if (object.httpEtag) {
    headers.set('ETag', object.httpEtag);
  }

  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(includeBody ? object.body : null, {
    status: 200,
    headers
  });
}

async function handleUploadRequest(params, includeBody) {
  try {
    const key = Array.isArray(params?.key) ? params.key.join('/') : params?.key;
    const object = await getUploadedObject(key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    return buildObjectResponse(object, includeBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load upload';
    const status = /Object key/i.test(message) ? 400 : 500;

    return new Response(message, { status });
  }
}

export async function GET(_request, context) {
  return handleUploadRequest(context?.params, true);
}

export async function HEAD(_request, context) {
  return handleUploadRequest(context?.params, false);
}
