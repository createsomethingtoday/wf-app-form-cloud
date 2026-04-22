/**
 * Report a caught error so it surfaces in runtime logs with any relevant
 * context. This is intentionally logging-only on Webflow Cloud because the
 * previous Sentry integration broke OpenNext bundling.
 */
export async function reportError(label, error, context = undefined) {
  const message = error?.message || String(error);
  if (context) {
    console.error(`${label}:`, message, context);
  } else {
    console.error(`${label}:`, message);
  }
}
