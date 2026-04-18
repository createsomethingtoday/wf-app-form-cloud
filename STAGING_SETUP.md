# Staging environment setup

Staging exists so we can break things without scaring customers. This file
documents the dashboard-only steps needed to finish what I started on the
CLI.

## What's already done

- **D1 database:** `wf-bl-app-form-cloud-staging`, id
  `f0a87641-ca63-499f-af99-abf57b912f2e`, in the Create Something Cloudflare
  account. `submissions` table and its 6 application indexes are already
  created via `scripts/migrations/0001_create_submissions.sql`.
- **R2 bucket:** `webflow-app-form-uploads-staging` in the same account.
  Empty, waiting for uploads.

Verify any time:

```bash
CLOUDFLARE_ACCOUNT_ID=9645bd52e640b8a4f40a3a55ff1dd75a \
  npx wrangler d1 execute wf-bl-app-form-cloud-staging --remote \
  --command="SELECT COUNT(*) FROM submissions"
```

## What still needs to happen

Six dashboard steps. They don't have to be done in order except where
noted. Budget ~30 minutes total.

### 1. Create a staging branch on GitHub

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Keep `staging` *behind* `main` — only merge into it when you want to promote
changes to the staging environment for testing. Never merge from staging
to main; merge from feature branches into main and let Webflow Cloud deploy
as usual. Staging is a validation target, not a promotion queue.

### 2. Create the D1 API token for staging

Same shape as production, different scope.

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. **Custom token** → **Get started**
3. Name: `wf-app-form-d1-staging`
4. Permissions: `Account` / `D1` / `Edit`
5. Account Resources: `Include` / `Create Something`
6. Continue → Create Token → copy the token.

Cloudflare tokens are not bucket-scoped — this token technically grants D1
Edit across the whole account, same as production. If you want tighter
scoping, Cloudflare has no per-database scope for D1 at the moment, so the
rotation playbook in `RUNBOOK.md` applies.

### 3. Create the R2 S3 credentials for staging

1. https://dash.cloudflare.com/9645bd52e640b8a4f40a3a55ff1dd75a/r2/api-tokens
2. **Create API Token**
3. Name: `wf-app-form-r2-staging`
4. Permissions: `Object Read & Write`
5. Specify buckets: **Apply to specific buckets only** → `webflow-app-form-uploads-staging` (NOT the production bucket)
6. Click **Create API Token**
7. On the result screen, **scroll past the `cfat_…` bearer token** to the
   "Use the following credentials for S3 clients" section.
8. Copy the **Access Key ID** (32 hex chars) and **Secret Access Key**
   (64 hex chars). Cloudflare only shows the secret once.

Test locally before proceeding:

```bash
CF_ACCOUNT_ID=9645bd52e640b8a4f40a3a55ff1dd75a \
CF_R2_BUCKET=webflow-app-form-uploads-staging \
CF_R2_ACCESS_KEY_ID=<new-access-key> \
CF_R2_SECRET_ACCESS_KEY=<new-secret> \
  npm run test:r2
```

Three `ok` lines = ready to use in step 5.

### 4. Create a Webflow Cloud staging environment

Dashboard-only. Webflow Cloud supports multiple environments per site,
each tied to a different Git branch and each with its own env vars.

1. Webflow dashboard → Webflow App Form site → **Webflow Cloud** tab
2. Webflow Cloud Projects → Webflow App Form → **Add environment** (or
   similar label; Webflow Cloud UI shifts occasionally)
3. Name: `staging`
4. Branch: `staging` (the one from step 1)
5. Path: `/app-form-staging`

Wait for the first deploy to complete. The URL will be
`https://webflow-app-form.webflow.io/app-form-staging`.

### 5. Set staging env vars

In the new staging environment's **Environment variables** tab, add these.
Values come from steps 2–3 above plus reuse where noted.

| Key | Type | Value |
|---|---|---|
| `CF_ACCOUNT_ID` | Plaintext | `9645bd52e640b8a4f40a3a55ff1dd75a` (same as prod) |
| `CF_D1_DATABASE_ID` | Plaintext | `f0a87641-ca63-499f-af99-abf57b912f2e` (staging) |
| `CF_API_TOKEN` | Secret | token from step 2 |
| `CF_R2_BUCKET` | Plaintext | `webflow-app-form-uploads-staging` |
| `CF_R2_ACCESS_KEY_ID` | Secret | access key from step 3 |
| `CF_R2_SECRET_ACCESS_KEY` | Secret | secret key from step 3 |
| `FORM_UPLOADS_PUBLIC_URL` | Plaintext | `https://webflow-app-form.webflow.io/app-form-staging/api/uploads` |
| `ADMIN_API_TOKEN` | Secret | `openssl rand -hex 32` — new value, not shared with prod |
| `CRON_SECRET` | Secret | `openssl rand -hex 32` — new value, not shared with prod |
| `WEBHOOK_URL` | Secret | **point at a staging Airtable webhook or a request-bin** — do NOT reuse the prod Airtable URL, or staging submissions will pollute the real app reviewers' queue |
| `AIRTABLE_API_KEY` | Secret | a staging-scoped Airtable PAT or the prod PAT if read-only flows are fine |
| `AUTOFILL_TOKEN_SECRET` | Secret | `openssl rand -hex 32` — new value |

Optional:

| Key | Type | Value |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Plaintext | same DSN as prod with `SENTRY_ENVIRONMENT=staging` set too |
| `SENTRY_DSN` | Secret | same DSN |
| `SENTRY_ENVIRONMENT` | Plaintext | `staging` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Plaintext | `staging` |
| `NEXT_PUBLIC_UPDATE_TOGGLES_ENABLED` | Plaintext | `true` (useful to exercise the Update flow in staging) |
| `NEXT_PUBLIC_AUTOFILL_UPDATE_ENABLED` | Plaintext | `true` |

The critical thing: **every field that writes side-effects (WEBHOOK_URL,
AIRTABLE_API_KEY) must be a different value than prod** or staging will
leak into production systems.

### 6. Sanity-check the deploy

Once staging deploy is live:

```bash
# Health check
curl -i https://webflow-app-form.webflow.io/app-form-staging/api/health
# → 200 { d1: "ok", r2: "ok" }

# Smoke suite against staging
BASE_URL=https://webflow-app-form.webflow.io/app-form-staging npm run test:e2e
```

## Running the full submit test against staging

The sketch in `tests/e2e/smoke.spec.js` currently throws a sentinel so the
E2E_ALLOW_SUBMIT=1 gate can't open until the field fills are fleshed out.
Once staging exists, fill out those field fills (there's ~15-20 fields on
the New flow), delete the sentinel throw, and run:

```bash
E2E_ALLOW_SUBMIT=1 \
BASE_URL=https://webflow-app-form.webflow.io/app-form-staging \
  npm run test:e2e
```

The full test should then file a submission, verify the success state,
optionally query D1 (via a staging admin token) to confirm the row landed.

## Workflow once staging is up

- Small changes: push to `main` → auto-deploys to prod. No staging trip
  needed for a one-line fix or a README update.
- Risky changes: land on a feature branch → merge into `staging` → verify
  in staging → merge into `main`.
- Config / env changes: apply to staging first, verify, then production.
  The R2 token rotation that caused the 2026-04-17 incident would have
  been caught in staging before customers saw it if this was the pattern.

## Secret management — is Infisical worth it?

At 12 env vars × 2 environments = 24 distinct values, plus rotation every
90 days or so for the sensitive ones, Webflow Cloud's dashboard works but
gets tedious. If you find yourself rotating a secret and forgetting to
update staging (or vice versa), that's a sign to pull the env into
Infisical (or 1Password Secrets Automation, or Cloudflare's own Secrets
Store) and sync from there to both Webflow Cloud environments.

We haven't crossed that threshold yet — staging is fresh and the
rotation playbook in `RUNBOOK.md` keeps things consistent. File this
as a future-investment when rotation gets painful.
