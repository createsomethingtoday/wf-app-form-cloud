const NON_ASCII_HEADER_VALUE = /[^\x00-\x7F]/;
const DIACRITIC_MARKS = /[\u0300-\u036f]/g;
const CLOUDFLARE_LOCATION_HEADERS = new Set([
  'cf-ipcity',
  'cf-region',
]);

function toAsciiHeaderValue(value) {
  return value
    .normalize('NFKD')
    .replace(DIACRITIC_MARKS, '')
    .replace(/[^\x20-\x7E\t]/g, '')
    .trim();
}

export function sanitizeCloudflareLocationHeaders(headersLike) {
  const headers = new Headers(headersLike);
  let mutated = false;

  for (const [name, value] of headers.entries()) {
    const normalizedName = name.toLowerCase();
    if (!CLOUDFLARE_LOCATION_HEADERS.has(normalizedName) || !NON_ASCII_HEADER_VALUE.test(value)) {
      continue;
    }

    const sanitized = toAsciiHeaderValue(value);
    mutated = true;

    if (sanitized) {
      headers.set(name, sanitized);
    } else {
      headers.delete(name);
    }
  }

  return { headers, mutated };
}

export function sanitizeIncomingRequest(request) {
  const { headers, mutated } = sanitizeCloudflareLocationHeaders(request.headers);
  if (!mutated) {
    return request;
  }

  return new Request(request, { headers });
}
