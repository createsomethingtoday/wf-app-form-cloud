import { d1Query } from '../../lib/d1Client';
import { r2Put, r2Delete } from '../../lib/r2Client';

/**
 * Unauthenticated health check for upstream dependencies.
 *
 * Returns:
 *   200 { d1: 'ok', r2: 'ok' }                            — all green
 *   503 { d1: 'ok' | '…error…', r2: 'ok' | '…error…' }    — one or both broken
 *
 * Checks:
 *   - D1: SELECT 1 — validates that the D1 REST token and database id work.
 *   - R2: PUT a tiny object, then DELETE it — validates that the S3
 *     credentials sign requests the bucket accepts on the write path.
 *     The prior version of this endpoint only did a GET, which missed the
 *     exact failure mode (SignatureDoesNotMatch on PUT) we hit in the
 *     2026-04-17 incident.
 *
 * Deliberately unauthenticated so external monitors (Datadog synthetic,
 * GitHub Actions scheduled check, uptime-kuma, etc.) can hit it without
 * a shared secret. The response body intentionally reveals only short
 * error messages (truncated to 160 chars) and never dumps env values or
 * full R2 responses — keep it that way.
 */
function truncate(message) {
  const text = typeof message === 'string' ? message : String(message ?? 'error');
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const result = { d1: 'ok', r2: 'ok' };

  try {
    await d1Query('SELECT 1 as ok', []);
  } catch (err) {
    result.d1 = truncate(err?.message || err);
  }

  // R2 round-trip: PUT a small object under a stable prefix, then DELETE it.
  // Both operations exercise the signing path aws4fetch produces against the
  // actual bucket, so a credential or endpoint misconfiguration surfaces here
  // before it surfaces on a real user upload.
  const probeKey = `health-check/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const probeBody = 'r2 health probe';

  try {
    await r2Put(probeKey, probeBody, 'text/plain');
  } catch (err) {
    result.r2 = truncate(err?.message || err);
  }

  if (result.r2 === 'ok') {
    // Best-effort cleanup. Not failing the check if DELETE has an issue —
    // R2's lifecycle could handle leftover health-check objects — but still
    // report it so we notice if write works and delete doesn't.
    try {
      await r2Delete(probeKey);
    } catch (err) {
      result.r2 = truncate(`put ok, delete failed: ${err?.message || err}`);
    }
  }

  const healthy = result.d1 === 'ok' && result.r2 === 'ok';
  res.status(healthy ? 200 : 503).json(result);
}
