# Runbook — Webflow Marketplace App Submission Form

For whoever's on call. Keep this open in a tab when something's on fire.

## Contacts and owners

- **App repo:** https://github.com/createsomethingtoday/wf-app-form-cloud
- **Production URL:** https://webflow-app-form.webflow.io/app-form
- **Embedded at:** https://developers.webflow.com/submit
- **Cloudflare account:** `Create Something` (`9645bd52e640b8a4f40a3a55ff1dd75a`)
- **D1 database:** `wf-bl-app-form-cloud` (`dff8622b-864e-4475-a4b7-29216881ea9b`)
- **R2 bucket:** `webflow-app-form-uploads`

## Where things live

| What | Where |
|---|---|
| Deployments, env vars, runtime logs | Webflow Cloud dashboard → the Webflow App Form site → Webflow Cloud tab |
| D1 console and schema | `dash.cloudflare.com/<acct>/workers/d1/databases/<db-id>` |
| R2 bucket and objects | `dash.cloudflare.com/<acct>/r2/default/buckets/webflow-app-form-uploads` |
| D1 API tokens | `dash.cloudflare.com/profile/api-tokens` (Account-scoped, D1 Edit) |
| R2 S3 credentials | `dash.cloudflare.com/<acct>/r2/api-tokens` (different page than above — read carefully) |
| GitHub repo secrets | Repo → Settings → Secrets and variables → Actions |
| Cron workflows | `.github/workflows/cron-retry-failed.yml`, `cron-cleanup-blobs.yml` |
| Sentry | (set up per README; DSN lives in Webflow Cloud env) |

## Quick health check

Run any time to confirm the app can still talk to its dependencies:

```bash
curl -i https://webflow-app-form.webflow.io/app-form/api/health
```

- `200 { d1: "ok", r2: "ok" }` → everything reachable.
- `503 { d1: "ok", r2: "…error text…" }` → R2 credentials or bucket config broken.
- `503 { d1: "…error text…", r2: "ok" }` → D1 token or database id broken.
- Anything else → fetch failed, Webflow Cloud is likely down or the deploy is mid-rotation.

The health endpoint does a real PUT + DELETE on R2 (small test object under the `health-check/` prefix), so a signing or credential issue on the write path is visible here.

## Deploy and rollback

**Normal deploy:** push to `main`. Webflow Cloud picks it up automatically and serves the new build in a couple minutes.

**Rollback:**

1. Webflow Cloud dashboard → Webflow Cloud tab → Deployments.
2. Find the last-known-good deployment (usually the one before the problematic commit).
3. Click the row → "Promote to Live".

This is instant — no code change needed. Use it as the first-line response for any customer-impacting issue. Fix forward afterwards.

## Common failure modes

### "Error: SUBMISSIONS_DB binding is required. This app is configured for Webflow Cloud SQLite only."

Legacy error from before the HTTP-based storage migration. If you see this, someone has reverted past commit `3eb9451`. Roll forward to the latest `main`.

### "Error: Environment variable CF_R2_ACCOUNT_ID is required" (or CF_D1_DATABASE_ID, etc.)

Exact message with the var name tells you which one's missing or blank in Webflow Cloud.

1. Webflow Cloud → Environment variables.
2. Check that the named var is present and has a value.
3. If `CF_R2_ACCOUNT_ID` specifically — it's *optional* and falls back to `CF_ACCOUNT_ID`. As of commit `98175ed` the code handles that correctly; older deploys threw on missing. Roll forward.

### R2 `SignatureDoesNotMatch` on form submit

Almost always credential drift. The S3 access key ID or secret in Webflow Cloud doesn't match what Cloudflare has on file.

1. Roll back the current deploy so customer submissions don't fail while you debug.
2. Cloudflare dashboard → **R2 → Manage R2 API Tokens** (not Account API Tokens — different page, different credentials).
3. Delete the existing R2 token, create a new one: Object Read & Write, scoped to `webflow-app-form-uploads`.
4. On the creation result screen, scroll *past* the `cfat_...` bearer token to the "Use the following credentials for S3 clients" section. Copy **Access Key ID** (32 hex chars) and **Secret Access Key** (64 hex chars). Both are only shown once.
5. Test locally before redeploying:
   ```bash
   CF_ACCOUNT_ID=9645bd52e640b8a4f40a3a55ff1dd75a \
   CF_R2_BUCKET=webflow-app-form-uploads \
   CF_R2_ACCESS_KEY_ID=<new-access-key> \
   CF_R2_SECRET_ACCESS_KEY=<new-secret> \
     npm run test:r2
   ```
   Three `ok` lines = credentials work.
6. Paste the new values into Webflow Cloud env vars. Redeploy.

### D1 query failures (auth error, 401, or 403)

1. Cloudflare dashboard → **My Profile → API Tokens**.
2. Find or create a user API token with `Account → D1 → Edit` scope.
3. Verify via curl:
   ```bash
   curl -s "https://api.cloudflare.com/client/v4/accounts/9645bd52e640b8a4f40a3a55ff1dd75a/d1/database/dff8622b-864e-4475-a4b7-29216881ea9b/query" \
     -X POST \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"sql": "SELECT 1 as ok"}'
   ```
   Expect `"success": true`.
4. Paste the new token as `CF_API_TOKEN` in Webflow Cloud. Redeploy.

### Webhook failures (submissions stuck at `webhook_failed`)

The app's automatic retry cron will attempt each failed row 3 times with 15-minute backoff, provided the cron workflow is actually running.

To check cron:
- GitHub → Actions → `Cron — Retry failed submissions`. Should show runs every 15 minutes.
- If no runs, `CRON_SECRET` is probably missing from the repo's Actions secrets. Add it (same value as in Webflow Cloud).

Manual retry for a specific submission:

```bash
curl -X POST "https://webflow-app-form.webflow.io/app-form/api/submissions/retry" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"submissionId": "<uuid>"}'
```

### "iframe doesn't scroll to pills" / "Edit buttons don't jump"

This bit us hard during development. The iframe is cross-origin to developers.webflow.com, so internal `scrollIntoView` doesn't scroll the parent page. The parent page embed script listens for `postMessage { type: 'SCROLL_TO_FORM' }`. If someone edits the embed script on the parent side and drops the listener, the iframe scroll will look broken even though the app is sending the right messages.

Verify the embed script on developers.webflow.com has the `SCROLL_TO_FORM` message handler — see the README's "Embedding" section for the canonical version.

## Rotating secrets

### `CF_API_TOKEN` (D1 access)

1. Create a new token at `dash.cloudflare.com/profile/api-tokens` with `Account → D1 → Edit`.
2. Verify with the curl above.
3. Update `CF_API_TOKEN` in Webflow Cloud.
4. Delete the old token from Cloudflare after the redeploy is live.

### R2 access key / secret

1. Cloudflare → **R2 → Manage R2 API Tokens** → create new token scoped to the bucket, Object Read & Write.
2. Run `npm run test:r2` locally with the new values.
3. Update `CF_R2_ACCESS_KEY_ID` and `CF_R2_SECRET_ACCESS_KEY` in Webflow Cloud.
4. Delete the old R2 token from Cloudflare after the redeploy is live.

### `CRON_SECRET`

Used in two places: Webflow Cloud env vars *and* GitHub repo Actions secrets. Must match.

1. Generate a new random value: `openssl rand -hex 32`.
2. Update both locations — Webflow Cloud env vars *and* GitHub → Settings → Secrets and variables → Actions.
3. Redeploy the app.
4. Manually trigger a workflow run to verify: GitHub → Actions → Cron — Retry failed submissions → Run workflow.

### `ADMIN_API_TOKEN`

Only used by admin endpoints. After rotation, existing admin-tool bookmarks / Postman collections need updating.

1. Generate a new value: `openssl rand -hex 32`.
2. Update `ADMIN_API_TOKEN` in Webflow Cloud.
3. Update any tooling that holds the token (usually just one person's machine).

### `AUTOFILL_TOKEN_SECRET`

Tokens issued with the old secret remain valid for their 10-minute TTL. Safe to rotate without coordination, but in-flight autofill sessions will fail for up to 10 minutes.

## Debug tools

- `npm run test:r2` — standalone R2 round-trip, same library (`aws4fetch`) as production.
- `/api/health` — public JSON endpoint, reports D1 and R2 status.
- Sentry — captures caught errors with stack traces and submission context.
- Webflow Cloud runtime logs — recent request logs, filterable.
- `wrangler d1 execute wf-bl-app-form-cloud --remote --command="SELECT * FROM submissions ORDER BY created_at DESC LIMIT 5"` — look at latest submissions.

## Known gotchas

- **Two Cloudflare token pages look similar and are not interchangeable.** "Account API Tokens" (`/profile/api-tokens`) produces `cfat_…` bearer tokens used for the Cloudflare REST API (D1 queries, etc.). "R2 API Tokens" (`/<acct>/r2/api-tokens`) produces S3-compatible Access Key ID + Secret Access Key used by `aws4fetch`. The R2 creation result screen shows *both* types of credentials — scroll past the `cfat_` to find the S3 ones.
- **Webflow Cloud runs its own OpenNext pipeline.** `wrangler.json`'s `main` and any `custom-worker.ts` are ignored. Platform-managed — you can't deploy a custom Worker entry on this stack.
- **OpenNext 1.8 rejects `runtime = 'edge'` on App Router routes.** Don't add it. This is why we use the HTTP path for D1/R2 instead of Worker bindings.
- **Embed script on developers.webflow.com needs `SCROLL_TO_FORM` listener.** If it's missing, step navigation inside the iframe looks broken. See README "Embedding" section.
- **Tests only cover pure functions.** 57 unit tests across `lib/*.test.js`. D1 client, R2 client, and the submit pipeline itself have no integration tests yet — any end-to-end regression needs to be caught manually or via the health endpoint.
