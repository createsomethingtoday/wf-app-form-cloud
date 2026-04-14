import { getCloudflareEnv } from './cloudflareRuntime';

function buildObjectKey(filename) {
  const safeFilename = (filename || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '-');
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `${datePrefix}/${crypto.randomUUID()}-${safeFilename}`;
}

function trimTrailingSlash(value) {
  return value ? value.replace(/\/$/, '') : value;
}

function normalizeObjectKey(value) {
  const normalized = String(value || '')
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');

  if (!normalized) {
    throw new Error('Object key is required');
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Object key contains invalid path segments');
  }

  return normalized;
}

function parseFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').filter(Boolean).pop();
    return filename ? decodeURIComponent(filename) : 'upload.bin';
  } catch {
    return 'upload.bin';
  }
}

async function getUploadsRuntime(runtime = {}) {
  const env = await getCloudflareEnv(runtime);
  const bucket = runtime.bucket || env?.FORM_UPLOADS;

  if (!bucket) {
    throw new Error('FORM_UPLOADS binding is required. This app is configured for Webflow Cloud Object Storage only.');
  }

  return {
    env,
    bucket
  };
}

function getPublicBaseUrl(env) {
  const publicBaseUrl = trimTrailingSlash(env?.FORM_UPLOADS_PUBLIC_URL || process.env.FORM_UPLOADS_PUBLIC_URL);

  if (!publicBaseUrl) {
    throw new Error(
      'FORM_UPLOADS_PUBLIC_URL must be configured as the public file route base URL, for example https://your-host/app-form/api/uploads'
    );
  }

  return publicBaseUrl;
}

function extractObjectKeyFromPublicUrl(url, publicBaseUrl) {
  const normalizedBaseUrl = trimTrailingSlash(publicBaseUrl);
  if (!url.startsWith(`${normalizedBaseUrl}/`)) {
    throw new Error(`Upload URL does not match FORM_UPLOADS_PUBLIC_URL: ${url}`);
  }

  const encodedKey = url.slice(normalizedBaseUrl.length + 1);
  const decodedKey = encodedKey
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');

  return normalizeObjectKey(decodedKey);
}

export async function buildPublicFileUrl(key, runtime = {}) {
  const { env } = await getUploadsRuntime(runtime);
  const publicBaseUrl = getPublicBaseUrl(env);
  const normalizedKey = normalizeObjectKey(key);
  const encodedKey = normalizedKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${publicBaseUrl}/${encodedKey}`;
}

export async function uploadPublicFile(file, runtime = {}) {
  const { env, bucket } = await getUploadsRuntime(runtime);
  const key = buildObjectKey(file.filename);

  await bucket.put(key, file.buffer, {
    httpMetadata: {
      contentType: file.contentType || 'application/octet-stream'
    }
  });

  return {
    key,
    url: await buildPublicFileUrl(key, { env, bucket })
  };
}

export async function deletePublicFile(url, runtime = {}) {
  const { env, bucket } = await getUploadsRuntime(runtime);
  const key = extractObjectKeyFromPublicUrl(url, getPublicBaseUrl(env));
  await bucket.delete(key);
}

export async function getUploadedObject(key, runtime = {}) {
  const { bucket } = await getUploadsRuntime(runtime);
  return bucket.get(normalizeObjectKey(key));
}

export async function copyRemoteFilesToUploads(urls, runtime = {}) {
  const uploadedFiles = [];

  for (const sourceUrl of urls || []) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch source upload: ${sourceUrl} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uploaded = await uploadPublicFile({
      filename: parseFilenameFromUrl(sourceUrl),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      buffer: arrayBuffer
    }, runtime);

    uploadedFiles.push({
      sourceUrl,
      ...uploaded
    });
  }

  return uploadedFiles;
}
