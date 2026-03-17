function normalizePrefix(value) {
  if (!value || value === '/') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (!withoutTrailingSlash || withoutTrailingSlash === '/') {
    return '';
  }

  return withoutTrailingSlash.startsWith('/')
    ? withoutTrailingSlash
    : `/${withoutTrailingSlash.replace(/^\/+/, '')}`;
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value) || value.startsWith('//');
}

export function getBasePath() {
  return normalizePrefix(
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    ''
  );
}

export function getAssetPrefix() {
  const assetPrefix = process.env.NEXT_PUBLIC_ASSETS_PREFIX || process.env.ASSETS_PREFIX || '';

  if (!assetPrefix) {
    return getBasePath();
  }

  return isAbsoluteUrl(assetPrefix)
    ? assetPrefix.replace(/\/+$/, '')
    : normalizePrefix(assetPrefix);
}

export function withBasePath(path) {
  if (!path) {
    return getBasePath() || '/';
  }

  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const basePath = getBasePath();

  if (!basePath || normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}

export function withAssetPrefix(path) {
  if (!path) {
    return getAssetPrefix() || '/';
  }

  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const assetPrefix = getAssetPrefix();

  if (!assetPrefix || normalizedPath === assetPrefix || normalizedPath.startsWith(`${assetPrefix}/`)) {
    return normalizedPath;
  }

  return `${assetPrefix}${normalizedPath}`;
}
