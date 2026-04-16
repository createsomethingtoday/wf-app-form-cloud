import { getEnvValue } from './cloudflareRuntime';
import { r2Put, r2Get, r2Delete } from './r2Client';

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

function getPublicBaseUrl(runtime) {
  const publicBaseUrl = trimTrailingSlash(getEnvValue('FORM_UPLOADS_PUBLIC_URL', runtime));

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
  const publicBaseUrl = getPublicBaseUrl(runtime);
  const normalizedKey = normalizeObjectKey(key);
  const encodedKey = normalizedKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${publicBaseUrl}/${encodedKey}`;
}

export async function uploadPublicFile(file, runtime = {}) {
  const key = buildObjectKey(file.filename);

  await r2Put(
    key,
    file.buffer,
    file.contentType || 'application/octet-stream',
    runtime,
  );

  return {
    key,
    url: await buildPublicFileUrl(key, runtime),
  };
}

export async function deletePublicFile(url, runtime = {}) {
  const key = extractObjectKeyFromPublicUrl(url, getPublicBaseUrl(runtime));
  await r2Delete(key, runtime);
}

export async function getUploadedObject(key, runtime = {}) {
  const response = await r2Get(normalizeObjectKey(key), runtime);
  if (!response) {
    return null;
  }

  return {
    body: response.body,
    size: Number(response.headers.get('Content-Length')) || undefined,
    httpMetadata: {
      contentType: response.headers.get('Content-Type') || undefined,
    },
    httpEtag: response.headers.get('ETag') || undefined,
  };
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
