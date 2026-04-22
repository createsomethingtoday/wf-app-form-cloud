import { getUploadedObject } from '../../../lib/blobStore';

function setObjectHeaders(res, object) {
  if (object.httpMetadata?.contentType) {
    res.setHeader('Content-Type', object.httpMetadata.contentType);
  }

  if (object.size !== undefined) {
    res.setHeader('Content-Length', String(object.size));
  }

  if (object.httpEtag) {
    res.setHeader('ETag', object.httpEtag);
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const key = Array.isArray(req.query?.key) ? req.query.key.join('/') : req.query?.key;
    const object = await getUploadedObject(key);

    if (!object) {
      return res.status(404).send('Not found');
    }

    setObjectHeaders(res, object);

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    const body = object.body ? Buffer.from(await new Response(object.body).arrayBuffer()) : Buffer.alloc(0);
    return res.status(200).send(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load upload';
    const status = /Object key/i.test(message) ? 400 : 500;
    return res.status(status).send(message);
  }
}
