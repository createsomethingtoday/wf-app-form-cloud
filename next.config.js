if (process.env.NODE_ENV === 'development') {
  try {
    const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');
    if (typeof initOpenNextCloudflareForDev === 'function') {
      initOpenNextCloudflareForDev();
    }
  } catch {
    // Local development should continue to work before the Cloudflare adapter is installed.
  }
}

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

const basePath = normalizePrefix(process.env.BASE_URL || '');
const assetPrefix = process.env.ASSETS_PREFIX
  ? process.env.ASSETS_PREFIX.replace(/\/+$/, '')
  : basePath;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: basePath || undefined,
  assetPrefix: assetPrefix || undefined,
  env: {
    NEXT_PUBLIC_BASE_URL: basePath,
    NEXT_PUBLIC_ASSETS_PREFIX: assetPrefix || '',
  },
  // Enable CORS for iframe embedding
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;"
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      }
    ]
  }
}

// Wrap the config with Sentry's build-time integration. Runs no-op when
// SENTRY_AUTH_TOKEN isn't set (local dev, branch previews), uploads source
// maps to Sentry when it is set (production builds).
let finalConfig = nextConfig;
try {
  const { withSentryConfig } = require('@sentry/nextjs');
  finalConfig = withSentryConfig(nextConfig, {
    silent: !process.env.SENTRY_DEBUG,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Skip source-map upload when no auth token (local dev, branch builds).
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Hide source maps from the public client bundle.
    hideSourceMaps: true,
    // Tree-shake Sentry logger statements.
    disableLogger: true,
    // Don't block builds on Sentry config errors.
    errorHandler: (err) => {
      console.warn('[sentry] build-time config warning:', err?.message || err);
    },
  });
} catch (err) {
  console.warn('[sentry] @sentry/nextjs not available at config time:', err?.message || err);
}

module.exports = finalConfig;
