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
  const headers = new Headers();
  let mutated = false;
  const entries = typeof headersLike?.entries === 'function'
    ? headersLike.entries()
    : Object.entries(headersLike || {});

  for (const [name, value] of entries) {
    const stringValue = String(value);
    const normalizedName = name.toLowerCase();
    if (!CLOUDFLARE_LOCATION_HEADERS.has(normalizedName) || !NON_ASCII_HEADER_VALUE.test(stringValue)) {
      headers.append(name, stringValue);
      continue;
    }

    const sanitized = toAsciiHeaderValue(stringValue);
    mutated = true;

    if (sanitized) {
      headers.append(name, sanitized);
    }
  }

  return { headers, mutated };
}

export function sanitizeIncomingRequest(request) {
  const { headers, mutated } = sanitizeCloudflareLocationHeaders(request.headers);
  if (!mutated) {
    return request;
  }

  try {
    return new Request(request, { headers });
  } catch (error) {
    if (!request.url) {
      throw error;
    }

    const init = {
      method: request.method,
      headers,
      redirect: request.redirect,
      signal: request.signal,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }

    return new Request(request.url, init);
  }
}
