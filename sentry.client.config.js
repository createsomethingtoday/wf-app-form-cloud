import * as Sentry from '@sentry/nextjs';

// Client-side Sentry init. Runs on every browser pageview that loads JS.
// DSN is opt-in via NEXT_PUBLIC_SENTRY_DSN so the app works fine in local dev
// and staging without a Sentry project attached.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
    // Error-only for v1 — no performance traces, keeps bundle small.
    tracesSampleRate: 0,
    // Don't replay sessions by default.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
