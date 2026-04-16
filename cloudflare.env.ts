import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getRuntimeCloudflareEnv() {
  try {
    const context = getCloudflareContext();
    if (context?.env) {
      return context.env;
    }
  } catch {
    // Static work can require the async path instead.
  }

  const asyncContext = await getCloudflareContext({ async: true });
  return asyncContext?.env || null;
}
