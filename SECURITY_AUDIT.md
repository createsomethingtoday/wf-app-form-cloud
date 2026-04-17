# Security audit — 2026-04-16

Scope: the auth layer and every file under `pages/api/`, plus the shared helpers
in `lib/apiAuth.js`, `lib/autofillToken.js`, and `lib/constantTimeEqual.js`.

## Summary

One real issue found and fixed (cron bearer-token comparison was not
constant-time). Everything else is in good shape — token-based auth is wired
correctly, the HMAC autofill token is sound, and the per-route auth choices
match what the endpoints do. Several things are worth watching as the app
grows; none are urgent.

## Findings

### Fixed in this pass

**F-1 — Cron auth used non-constant-time comparison.** *(Severity: low.)*

`pages/api/cron/retry-failed.js` and `pages/api/cron/cleanup-blobs.js` compared
the full Authorization header against `"Bearer " + cronSecret` with `!==`. In
theory an attacker could measure response timing to infer the secret byte by
byte; in practice timing signal is drowned out by network variance and V8's
non-deterministic string comparison. Still a best-practice violation.

Both endpoints now use `constantTimeEqual`, matching how `apiAuth.js` already
gated the `ADMIN_API_TOKEN` routes. Handled in the same commit as this report.

### Still open — watch-list

**W-1 — No rate limiting on any endpoint.** `/api/verify-client-id` is public
and performs an external fetch on every call; an attacker could amplify load
on the upstream `check-asset-name.vercel.app` via this endpoint. `/api/submit-form`
is similarly unprotected and accepts multipart uploads up to 10 MB per file.
Webflow Cloud / Cloudflare does not apply app-level rate limiting by default.
Mitigation options: (a) add a basic IP rate limit via Cloudflare rules on the
hostname, (b) add a simple in-process counter keyed by IP with a short TTL in
KV/D1, (c) gate the verify endpoint behind a human check when abnormal
volume is observed.

**W-2 — `/api/verify-client-id` leaks client-ID existence to the public.** The
endpoint returns `{ clientIdExists: true/false }` for any submitted client ID
and, when `submissionType === 'Update'` and the ID exists, also issues an
autofill token (10-minute HMAC, signed, scoped to that client ID). An
attacker who already knows or guesses a valid client ID can therefore obtain
a token good for 10 minutes and then call `/api/airtable/get-app` to read the
allowlisted fields for that app.

The autofill token is scoped and short-lived (good), and the fields returned
are already the "allowed" projection (good), but the overall chain lets
anyone who knows a client ID read public-ish app data. If client IDs are
treated as semi-secret, consider: (a) requiring a human-auth step before
issuing the token, (b) adding a per-IP throttle on verify, (c) narrowing
the returned fields further (e.g. omit credential-ish notes).

**W-3 — Log lines occasionally include client IDs.** `pages/api/airtable/get-app.js`
logs `{ clientId }` on every successful lookup. Client IDs aren't highly
sensitive on their own, but once logs fan out (Sentry, CF Logpush, etc.) it
becomes harder to revoke them from observability tools. Consider truncating
(`clientId.slice(0,8)`) or hashing for log lines.

**W-4 — No CSRF or Origin check on POST endpoints.** `/api/submit-form`,
`/api/verify-client-id`, and `/api/submissions/*` all accept cross-origin
POSTs. For the admin routes this is OK because they require `ADMIN_API_TOKEN`.
For `/api/submit-form` and `/api/verify-client-id`, a malicious site could
submit on behalf of a logged-in user's browser — but there's no session to
hijack (the form doesn't use cookies), so this is mostly a content-abuse
vector rather than an account-takeover one. Low priority.

**W-5 — `AUTOFILL_TOKEN_SECRET` falls back to `ADMIN_API_TOKEN`.**
`lib/autofillToken.js` line 30-34:

```js
return (
  await getEnvValue('AUTOFILL_TOKEN_SECRET', runtime) ||
  await getEnvValue('ADMIN_API_TOKEN', runtime) ||
  ''
);
```

This is convenient for bootstrap but means in current production (where no
`AUTOFILL_TOKEN_SECRET` is set) the autofill HMAC and the admin bearer-token
derive from the same secret. If `ADMIN_API_TOKEN` ever leaks, an attacker
can both call admin endpoints AND forge autofill tokens. Recommended: set a
dedicated `AUTOFILL_TOKEN_SECRET` env var in Webflow Cloud and remove the
admin-token fallback.

**W-6 — No Content-Security-Policy on the rendered form.** `vercel.json`
declares one but it isn't applied (app is on Webflow Cloud, not Vercel).
Webflow Cloud doesn't read that file. If we care about CSP on the form
page (we probably do given it accepts user-uploaded images), we need to
set headers via Webflow Cloud's platform settings or add them in
`_document.js` / `next.config.js`.

## Things that looked good

- **`constantTimeEqual`** handles length mismatch up front, encodes to a
  `Uint8Array` before comparing, and ORs XOR'd bytes — textbook. Tests now
  pin this behavior.
- **`apiAuth.js`** correctly parses the `Bearer ` scheme, rejects missing or
  malformed headers, distinguishes "unconfigured" (503) from "wrong token"
  (401), and uses `constantTimeEqual`. Same pattern should be the canonical
  way to auth any future admin endpoint.
- **`autofillToken.js`** uses WebCrypto HMAC-SHA256 and verifies signatures
  with `constantTimeEqual`. Tokens are explicitly bound to a client ID and
  expire after 10 minutes. Good shape for a short-lived capability token.
- **Admin routes consistently call `requireAdminApiToken` as the first
  thing after method-check.** No accidental unauth paths found.
- **UUID validation** on `/api/submissions/[id]` rejects non-UUID ids
  before hitting the DB, reducing injection surface (though D1 prepared
  statements already parameterize values).
- **Allowlisted field projection** in `/api/airtable/get-app` prevents
  sibling-record fields from leaking via the autofill endpoint.

## Recommended next actions, in order

1. **Set `AUTOFILL_TOKEN_SECRET`** as a distinct env var in Webflow Cloud
   and remove the `ADMIN_API_TOKEN` fallback in `lib/autofillToken.js`.
   (5 min.)
2. **Add basic rate limiting** on `/api/verify-client-id` and `/api/submit-form`.
   Cloudflare Rules on the hostname would be the cheapest path. (30 min via
   Cloudflare dashboard, no code change.)
3. **Truncate client IDs in log lines** to the first 8 chars. (10 min.)
4. **Sort out CSP** — if this matters, set headers via `next.config.js`
   `headers()` option, which OpenNext applies at the edge. (30 min.)

None of these block shipping what's already in production.
