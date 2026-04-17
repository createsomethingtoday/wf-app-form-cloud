/**
 * Report a caught error so it surfaces in both runtime logs and Sentry.
 *
 * Sentry.captureException is a no-op when Sentry.init() hasn't run (i.e.
 * when no SENTRY_DSN is configured), so this is always safe to call even
 * in environments without Sentry attached.
 *
 * `context` is attached to the Sentry event as `extra` so the stack trace
 * isn't the only breadcrumb — include submission IDs, field names, etc.
 * as relevant so the event is actionable without cross-referencing logs.
 */
export async function reportError(label, error, context = undefined) {
  const message = error?.message || String(error);
  if (context) {
    console.error(`${label}:`, message, context);
  } else {
    console.error(`${label}:`, message);
  }

  try {
    const Sentry = await import('@sentry/nextjs');
    if (typeof Sentry.captureException === 'function') {
      Sentry.captureException(error, context ? { extra: context, tags: { label } } : { tags: { label } });
    }
  } catch {
    // Sentry not available at runtime — logs above are sufficient.
  }
}
