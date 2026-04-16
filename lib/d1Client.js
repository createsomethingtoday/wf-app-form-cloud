import { requireEnvValue } from './cloudflareRuntime';

function buildQueryUrl(runtime) {
  const accountId = requireEnvValue('CF_ACCOUNT_ID', runtime);
  const databaseId = requireEnvValue('CF_D1_DATABASE_ID', runtime);
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
}

export async function d1Query(sql, params, runtime = {}) {
  const url = buildQueryUrl(runtime);
  const token = requireEnvValue('CF_API_TOKEN', runtime);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params: params ?? [] }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    const errors = body?.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`D1 query failed (${response.status}): ${errors}`);
  }

  const statement = Array.isArray(body.result) ? body.result[0] : body.result;

  return {
    rows: statement?.results ?? [],
    meta: statement?.meta ?? {},
  };
}

export async function d1First(sql, params, runtime = {}) {
  const { rows } = await d1Query(sql, params, runtime);
  return rows[0] ?? null;
}
