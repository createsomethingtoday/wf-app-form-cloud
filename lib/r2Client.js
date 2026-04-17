import { AwsClient } from 'aws4fetch';
import { requireEnvValue, getEnvValue } from './cloudflareRuntime';

function buildClient(runtime) {
  return new AwsClient({
    accessKeyId: requireEnvValue('CF_R2_ACCESS_KEY_ID', runtime),
    secretAccessKey: requireEnvValue('CF_R2_SECRET_ACCESS_KEY', runtime),
    service: 's3',
    region: 'auto',
  });
}

function buildBucketUrl(runtime) {
  // CF_R2_ACCOUNT_ID is optional and falls back to CF_ACCOUNT_ID. Use
  // getEnvValue (returns undefined) so the OR short-circuit works — the
  // throwing requireEnvValue blew up on the first call before falling through.
  const accountId = getEnvValue('CF_R2_ACCOUNT_ID', runtime) || getEnvValue('CF_ACCOUNT_ID', runtime);
  if (!accountId) {
    throw new Error('Environment variable CF_R2_ACCOUNT_ID (or CF_ACCOUNT_ID as fallback) is required');
  }
  const bucket = requireEnvValue('CF_R2_BUCKET', runtime);
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
}

function encodeKey(key) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function r2Put(key, body, contentType, runtime = {}) {
  const client = buildClient(runtime);
  const url = `${buildBucketUrl(runtime)}/${encodeKey(key)}`;

  const headers = new Headers();
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  const response = await client.fetch(url, {
    method: 'PUT',
    body,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 put failed (${response.status}): ${text}`);
  }
}

export async function r2Get(key, runtime = {}) {
  const client = buildClient(runtime);
  const url = `${buildBucketUrl(runtime)}/${encodeKey(key)}`;

  const response = await client.fetch(url, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 get failed (${response.status}): ${text}`);
  }

  return response;
}

export async function r2Delete(key, runtime = {}) {
  const client = buildClient(runtime);
  const url = `${buildBucketUrl(runtime)}/${encodeKey(key)}`;

  const response = await client.fetch(url, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 delete failed (${response.status}): ${text}`);
  }
}

export function hasR2Config(runtime = {}) {
  return Boolean(
    getEnvValue('CF_R2_ACCESS_KEY_ID', runtime)
      && getEnvValue('CF_R2_SECRET_ACCESS_KEY', runtime)
      && getEnvValue('CF_R2_BUCKET', runtime)
      && (getEnvValue('CF_R2_ACCOUNT_ID', runtime) || getEnvValue('CF_ACCOUNT_ID', runtime)),
  );
}
