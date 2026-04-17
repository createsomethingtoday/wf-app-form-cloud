#!/usr/bin/env node
/**
 * Standalone R2 connectivity test.
 *
 * Runs a PUT + GET + DELETE round-trip against the R2 bucket using the same
 * library (aws4fetch) and config shape the app uses. Intended as an out-of-app
 * debug helper — run it locally with the exact env vars set in Webflow Cloud
 * to isolate whether a SignatureDoesNotMatch or similar is coming from the
 * credentials (fails here too) or from something else (succeeds here, fails
 * in production).
 *
 * Usage:
 *   CF_ACCOUNT_ID=... \
 *   CF_R2_ACCESS_KEY_ID=... \
 *   CF_R2_SECRET_ACCESS_KEY=... \
 *   CF_R2_BUCKET=webflow-app-form-uploads \
 *     node scripts/test-r2.mjs
 */
import { AwsClient } from 'aws4fetch';

const accountId = process.env.CF_R2_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
const bucket = process.env.CF_R2_BUCKET;

const missing = [];
if (!accountId) missing.push('CF_ACCOUNT_ID (or CF_R2_ACCOUNT_ID)');
if (!accessKeyId) missing.push('CF_R2_ACCESS_KEY_ID');
if (!secretAccessKey) missing.push('CF_R2_SECRET_ACCESS_KEY');
if (!bucket) missing.push('CF_R2_BUCKET');
if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(', ')}`);
  process.exit(1);
}

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: 's3',
  region: 'auto',
});

const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
const key = `connectivity-check/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
const body = 'R2 connectivity test from scripts/test-r2.mjs';
const url = `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function step(label, fn) {
  const start = Date.now();
  process.stdout.write(`${label} ... `);
  try {
    const result = await fn();
    console.log(`ok (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    console.log('FAIL');
    console.error(err.message || err);
    process.exit(1);
  }
}

await step(`PUT ${key}`, async () => {
  const res = await client.fetch(url, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!res.ok) {
    throw new Error(`PUT ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
});

await step(`GET ${key}`, async () => {
  const res = await client.fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`GET ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const got = await res.text();
  if (got !== body) {
    throw new Error(`GET body mismatch: expected ${body.length}B, got ${got.length}B`);
  }
});

await step(`DELETE ${key}`, async () => {
  const res = await client.fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
});

console.log(`\nR2 connectivity OK for bucket ${bucket}.`);
