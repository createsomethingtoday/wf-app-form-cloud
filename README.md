# Webflow Marketplace App Submission Form

A Next.js submission form embedded via iframe in
[developers.webflow.com/submit](https://developers.webflow.com/submit). It
collects marketplace app submissions, persists them to a Cloudflare D1
database, uploads attachments to Cloudflare R2, delivers the payload to
Airtable via webhook, and retries on failure.

## Architecture

```
       ┌──────────────────────────────────────────────────────────────────┐
       │                 developers.webflow.com/submit (iframe host)      │
       │                                                                  │
       │   ┌────────────────────────────────────────────────────────────┐ │
       │   │   webflow-app-form.webflow.io/app-form  (this repo)        │ │
       │   │   Next.js 15 + OpenNext on Webflow Cloud (Cloudflare)      │ │
       │   │                                                            │ │
       │   │   Submit → D1 REST ────────────► Cloudflare D1             │ │
       │   │          → R2 via S3 (aws4fetch) ► Cloudflare R2           │ │
       │   │          → Webhook (Airtable)                              │ │
       │   └────────────────────────────────────────────────────────────┘ │
       └──────────────────────────────────────────────────────────────────┘

       Separately:
       ┌──────────────────────────────────────────────────────────────────┐
       │ GitHub Actions scheduled workflows                               │
       │   ─ every 15 min → POST /api/cron/retry-failed                   │
       │   ─ every  6 hr  → POST /api/cron/cleanup-blobs                  │
       └──────────────────────────────────────────────────────────────────┘
```

**Key bit worth knowing up front:** the app is deployed on Webflow Cloud, but
D1 and R2 live in the *user's own* Cloudflare account and are accessed over
HTTP — not through Worker bindings. That's deliberate: OpenNext 1.8.0 on
Webflow Cloud rejects `export const runtime = 'edge'` on App Router routes,
which is what Webflow Cloud's docs require for Worker bindings to reach the
handler. Going over HTTP sidesteps that deadlock entirely. See
`lib/d1Client.js` and `lib/r2Client.js`.

## Features

### Form UX

- **Step wizard by default** with a progress rail at the top. Each of 7 steps
  (App info → Creator info → App details → Credentials → Support info →
  Agreement → Review) is isolated via CSS `display: none` so validation, refs,
  and the Quill editor stay mounted.
- **Show all fields toggle** (persisted in `localStorage`) to read the whole
  form at once.
- **Dynamic features list** — single input with Enter-to-add, reorder via
  ↑↓, remove via ×. Replaces five fixed `Feature 1..5` inputs.
- **Dynamic screenshots list** — drop zone + per-item card with thumbnail,
  inline alt-text, size, reorder, remove.
- **Drag-and-drop** on the app icon upload, with image thumbnail preview.
- **Inline URL validation** — green check / red warning on blur, auto-prepends
  `https://`.
- **Segmented support contact picker** — Email or Website, not both; replaces
  the old "either/or required" banner.
- **Review step** with per-section Edit pills that jump back into that step.
- **Autosave to `localStorage`** every ~1s debounced. On return within 24 h a
  blue banner offers to resume.
- **`beforeunload` warning** when unsaved work exists.
- **Character counters** on fields with `maxLength`, amber at 90%, red at
  limit.
- **Focus-on-step-change** + `aria-live` step announcement for keyboard and
  screen-reader users.

### Backend

- **Cloudflare D1 via REST** (`lib/d1Client.js`). Queries use the same
  prepared-statement shape you'd get from a Worker binding.
- **Cloudflare R2 via S3 API** (`lib/r2Client.js`). Signed with
  [`aws4fetch`](https://github.com/mhart/aws4fetch).
- **Airtable webhook** on submit. Full submission body plus URLs to the R2
  blobs.
- **Submission lifecycle** tracked in D1: `processing` → `pending` →
  `webhook_success` / `webhook_failed`.
- **Automatic retries** via GitHub Actions scheduled workflow hitting
  `/api/cron/retry-failed` every 15 min. 3 attempts, 15-min backoff.
- **Blob cleanup** via a second workflow every 6 h — drops R2 objects for
  submissions older than 24 h that delivered successfully.
- **Search and single-submission APIs** for the reviewer team, gated by
  `ADMIN_API_TOKEN`.
- **Airtable autofill** for Update submissions via a short-lived HMAC token
  minted by `/api/verify-client-id`.

## Local development

```bash
git clone https://github.com/createsomethingtoday/wf-app-form-cloud.git
cd wf-app-form-cloud
npm install

# Env for local dev — see Environment variables section
cp .env.local.example .env.local
$EDITOR .env.local

npm run dev     # http://localhost:3000
npm test        # vitest — 57 tests cover the pure-function layer
npm run lint
```

The iframe hosts on developers.webflow.com load the deployed version. For UI
work locally, open http://localhost:3000 directly (bypasses the iframe
wrapper). The form detects whether it's in an iframe and skips the parent
postMessage branches when it isn't.

## Deployment

Webflow Cloud deploys on push to `main`:

1. Push to `origin/main`.
2. Webflow Cloud detects the commit via its GitHub integration.
3. Webflow Cloud runs `next build && opennextjs-cloudflare build`.
4. The built worker serves from `https://webflow-app-form.webflow.io/app-form`.

No manual `webflow cloud deploy` needed. For rollback, use the
**Deployments** tab in the Webflow Cloud dashboard — every build lists a
"Promote to live" action.

### Backing services (done once per environment)

This app assumes two Cloudflare resources exist in the target account:

- A D1 database (any name; we use `wf-bl-app-form-cloud`)
- An R2 bucket (any name; we use `webflow-app-form-uploads`)

Schema for D1:

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  npx wrangler d1 execute <db-name> --remote \
  --file=scripts/migrations/0001_create_submissions.sql
```

API tokens needed (create via Cloudflare dashboard):

- **`CF_API_TOKEN`** — user API token, scope `Account → D1 → Edit`.
- **R2 Account API token** — `Object Read & Write` scoped to the bucket.
  This gives you an Access Key ID and Secret Access Key.

Those values go into the Webflow Cloud **Environment variables** tab.

## Environment variables

Production values live in the Webflow Cloud dashboard. `.env.local.example`
is the source of truth for local dev.

### Required at runtime

```bash
# Cloudflare D1 (HTTP REST API)
CF_ACCOUNT_ID=<cloudflare-account-id>
CF_D1_DATABASE_ID=<d1-database-uuid>
CF_API_TOKEN=<token-with-D1-Edit-scope>          # secret

# Cloudflare R2 (S3 API via aws4fetch)
CF_R2_BUCKET=<bucket-name>
CF_R2_ACCESS_KEY_ID=<r2-access-key-id>           # secret
CF_R2_SECRET_ACCESS_KEY=<r2-secret-access-key>   # secret
# CF_R2_ACCOUNT_ID is optional; falls back to CF_ACCOUNT_ID if unset.

# Public URL the uploads route serves blobs under
FORM_UPLOADS_PUBLIC_URL=https://webflow-app-form.webflow.io/app-form/api/uploads

# Admin + webhook secrets
ADMIN_API_TOKEN=<long-random-string>             # secret
WEBHOOK_URL=https://hooks.airtable.com/workflows/v1/genericWebhook/...  # secret
CRON_SECRET=<long-random-string>                 # secret

# Airtable autofill (only needed if Update flow is enabled)
AIRTABLE_API_KEY=pat...                          # secret
AUTOFILL_TOKEN_SECRET=<long-random-string>       # secret (see note below)
```

> **Note on `AUTOFILL_TOKEN_SECRET`.** If unset, the autofill HMAC falls back
> to `ADMIN_API_TOKEN`. That works but is flagged in `SECURITY_AUDIT.md` —
> set a distinct secret so rotating one doesn't affect the other.

### Optional / feature-gated

```bash
# Client ID allow-list used when the upstream verification endpoint is down.
VALID_CLIENT_IDS=client123,client456

# Enables the Update submission toggles and autofill-on-verify.
NEXT_PUBLIC_UPDATE_TOGGLES_ENABLED=true
NEXT_PUBLIC_AUTOFILL_UPDATE_ENABLED=true
```

### GitHub repository secrets

The two cron workflows require `CRON_SECRET` to be set as a repo secret:
`Settings → Secrets and variables → Actions → New repository secret`. Use the
same value as in Webflow Cloud.

## API reference

### Public

| Method & path                           | Notes |
|-----------------------------------------|-------|
| `POST /api/submit-form`                 | Multipart form data. Returns `{ success, submissionId, airtableSubmissionId, filesUploaded }`. |
| `POST /api/verify-client-id`            | Body: `{ clientId, submissionType }`. Returns `{ clientIdExists, autofillToken? }`. |
| `GET  /api/uploads/[...key]`            | Serves R2 objects publicly. |
| `GET  /api/airtable/get-app?clientId=…` | Requires `x-autofill-token` header from `/api/verify-client-id`. Returns allowlisted Airtable fields. |

### Admin (Bearer `ADMIN_API_TOKEN`)

| Method & path                      | Notes |
|------------------------------------|-------|
| `GET  /api/submissions/search`     | Filters: `appName`, `clientId`, `creatorEmail`, `status`, `startDate`, `endDate`, `limit`, `offset`. |
| `GET  /api/submissions/[id]`       | Full submission including `form_data` and `blob_urls`. |
| `POST /api/submissions/retry`      | Body: `{ submissionId }`. |
| `POST /api/submissions/import`     | Idempotent by submission ID; used by the backfill script. |

### Cron (Bearer `CRON_SECRET`)

| Method & path                    | Schedule         | Process |
|----------------------------------|------------------|---------|
| `POST /api/cron/retry-failed`    | every 15 min     | Resend failed webhooks, max 3 attempts per row. |
| `POST /api/cron/cleanup-blobs`   | every 6 h        | Delete R2 objects for successful submissions older than 24 h. |

Both endpoints are invoked from GitHub Actions workflows under
`.github/workflows/`. Nothing inside Webflow Cloud runs these on a schedule.

## Testing

Vitest covers the pure-function surface where regressions hurt most:

```bash
npm test            # single run
npm run test:watch  # watch mode
```

Current coverage (57 tests):

- `lib/submissionPayload.test.js` — Airtable payload mapping, New vs Update
  branching, blob URL slot placement, retry metadata
- `lib/marketplaceCategories.test.js` — normalization, validation, invariants
- `lib/constantTimeEqual.test.js` — auth primitive edge cases
- `lib/wizardSections.test.js` — `computeSectionStatus`, section shape
  invariants
- `lib/r2Client.test.js` — `hasR2Config` across fallback, explicit, and
  missing-var cases

`lib/db.js` and `lib/blobStore.js` are intentionally not covered here — they
need `fetch` mocks and live integration rather than unit tests.

## Security

See **`SECURITY_AUDIT.md`** for a walk-through of the auth layer (cron,
admin, autofill) and a watchlist of items to improve:

- No rate limiting on public endpoints
- `/api/verify-client-id` leaks client-ID existence to anonymous callers
- `AUTOFILL_TOKEN_SECRET` should be distinct from `ADMIN_API_TOKEN`

Nothing in the watchlist blocks production.

## Project structure

```
├── app/
│   └── api/
│       ├── submit-form/route.js         # App Router submission handler
│       └── uploads/[...key]/route.js    # Public blob proxy
├── components/                          # Form UI components
│   ├── FormField.js                     # Text + URL validation + counter
│   ├── TextAreaField.js                 # Textarea + counter
│   ├── FeaturesList.js                  # Dynamic features
│   ├── ScreenshotsList.js               # Dynamic screenshots
│   ├── FileUploadField.js               # Drag-drop avatar upload
│   ├── FormProgressRail.js              # Step navigation pills
│   ├── ReviewSummary.js                 # Per-section review cards
│   ├── CheckboxGroup.js
│   └── QuillEditor.js
├── lib/
│   ├── d1Client.js                      # D1 REST query + first-row helpers
│   ├── r2Client.js                      # R2 put/get/delete via aws4fetch
│   ├── db.js                            # Public db.* API backed by d1Client
│   ├── blobStore.js                     # Public blob API backed by r2Client
│   ├── cloudflareRuntime.js             # getEnvValue / requireEnvValue
│   ├── submissionPayload.js             # Airtable webhook payload builder
│   ├── submitFormRuntime.js             # Submit handler (runtime-agnostic)
│   ├── marketplaceCategories.js         # Category validation
│   ├── wizardSections.js                # FORM_SECTIONS, status helpers
│   ├── formDraft.js                     # Autosave constants + helpers
│   ├── apiAuth.js                       # Bearer-token helper
│   ├── autofillToken.js                 # HMAC autofill token
│   ├── constantTimeEqual.js             # Timing-safe comparison
│   ├── runtimePaths.js                  # BASE_URL-aware path helpers
│   ├── analytics.js                     # Vercel analytics wrapper
│   └── themeSupport.js                  # Parent theme detection
├── pages/
│   ├── api/                             # Pages Router for admin + cron
│   │   ├── submissions/
│   │   ├── airtable/
│   │   ├── cron/
│   │   └── verify-client-id.js
│   ├── complete-form.js                 # Single-page form UI (3,400 lines)
│   └── index.js                         # Renders complete-form
├── scripts/
│   ├── migrations/0001_create_submissions.sql
│   └── backfill-webflow-cloud.mjs       # One-time data migration helper
├── .github/workflows/
│   ├── cron-retry-failed.yml            # 15-minute retry trigger
│   └── cron-cleanup-blobs.yml           # 6-hour cleanup trigger
├── webflow.json                         # { cloud: { framework: "nextjs" } }
├── wrangler.json                        # Minimal Wrangler config
├── vitest.config.mjs
├── next.config.js                       # basePath, CSP, headers()
├── vercel.json                          # CSP headers (legacy; not deployed)
└── SECURITY_AUDIT.md                    # Auth review and watchlist
```

`custom-worker.ts` used to sit at the root for a standalone Cloudflare deploy
path. It's been removed since Webflow Cloud ignores `main` in `wrangler.json`
and runs its own OpenNext pipeline.

## Embedding on developers.webflow.com

The iframe is embedded as:

```html
<script src="https://webflow-app-form.webflow.io/app-form/webflow-iframe-styles.js" defer></script>
<script>
  (function () {
    const IFRAME_ID = 'marketplace-form-app';
    const APP_ORIGIN = 'https://webflow-app-form.webflow.io';

    function getIframe() {
      return document.getElementById(IFRAME_ID);
    }

    // Iframe requests to scroll the parent page to itself (Next/Previous,
    // pill clicks, step changes). Required for cross-origin because the
    // iframe can't scroll the parent directly.
    window.addEventListener('message', function (event) {
      if (event.origin !== APP_ORIGIN || !event.data) return;
      if (event.data.type === 'SCROLL_TO_FORM') {
        const iframe = getIframe();
        if (iframe) iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Pass URL-driven feature flags into the iframe.
    function sendFeatureFlags() {
      const iframe = getIframe();
      if (!iframe || !iframe.contentWindow) return;
      const urlParams = new URLSearchParams(window.location.search);
      const updateToggles = urlParams.get('updateToggles') === 'true';
      const autofillUpdate = urlParams.get('autofillUpdate') === 'true';
      if (updateToggles || autofillUpdate) {
        iframe.contentWindow.postMessage(
          { type: 'featureFlag', updateToggles, autofillUpdate },
          APP_ORIGIN,
        );
      }
    }

    window.addEventListener('DOMContentLoaded', function () {
      const iframe = getIframe();
      if (!iframe) return;
      iframe.addEventListener('load', sendFeatureFlags);
    });
  })();
</script>

<iframe
  id="marketplace-form-app"
  src="https://webflow-app-form.webflow.io/app-form/complete-form"
  title="Marketplace form app"
  width="100%"
  height="800"
  loading="lazy"
  style="border: 0; display: block">
</iframe>
```

The `SCROLL_TO_FORM` listener is not optional — step navigation inside the
iframe depends on it to keep the form visible on the parent page.

## One-time data migration (only if needed)

If you're moving from an existing form deployment, the backfill script
reads submissions from the source app's admin API and writes them into the
new D1 via `/api/submissions/import` (idempotent by submission ID):

```bash
SOURCE_APP_URL=https://old-app.example.com \
SOURCE_ADMIN_API_TOKEN=... \
TARGET_APP_URL=https://webflow-app-form.webflow.io/app-form \
TARGET_ADMIN_API_TOKEN=... \
npm run backfill:webflow-cloud
```

This is a one-shot utility; it does not run as part of any deploy.
