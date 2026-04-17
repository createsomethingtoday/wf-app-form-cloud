import * as Sentry from '@sentry/nextjs';

// Edge runtime Sentry init. None of our current API routes use Next.js's
// edge runtime (OpenNext 1.8 rejects it), but keeping this file for
// completeness — instrumentation.js conditionally loads it.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: 0,
  });
}
