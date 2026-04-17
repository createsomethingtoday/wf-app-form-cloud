import { d1Query } from '../../lib/d1Client';
import { r2Get } from '../../lib/r2Client';

/**
 * Unauthenticated health check for upstream dependencies.
 *
 * Returns:
 *   200 { d1: 'ok', r2: 'ok' }                            — all green
 *   503 { d1: 'ok' | '…error…', r2: 'ok' | '…error…' }    — one or both broken
 *
 * Deliberately unauthenticated so external monitors (Datadog synthetic,
 * GitHub Actions scheduled check, uptime-kuma, etc.) can hit it without
 * a shared secret. The response body intentionally reveals only
 * short error messages (truncated to 160 chars) and never dumps env
 * values or full R2 responses — keep it that way.
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

  try {
    // A GET on a known-missing key exercises the same signing + endpoint the
    // submit path uses. r2Get returns null on 404 (credentials valid), throws
    // on auth/network errors.
    await r2Get('health-check/does-not-exist');
  } catch (err) {
    result.r2 = truncate(err?.message || err);
  }

  const healthy = result.d1 === 'ok' && result.r2 === 'ok';
  res.status(healthy ? 200 : 503).json(result);
}
