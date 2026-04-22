export async function trackEvent(name, properties = {}) {
  void name;
  void properties;
  // Webflow Cloud does not use Vercel Analytics. Keep this as a no-op so
  // operational hooks can call it safely without affecting request paths.
}
