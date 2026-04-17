import * as Sentry from '@sentry/nextjs';

// Server-side Sentry init — runs in OpenNext's Node-compat Workers runtime.
// Loaded from instrumentation.js when the Node runtime boots.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: 0,
  });
}
