export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(err, request, errorContext) {
  if (typeof process !== 'undefined' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    if (typeof Sentry.captureRequestError === 'function') {
      Sentry.captureRequestError(err, request, errorContext);
    }
  }
}
