import { getEnvValue } from './cloudflareRuntime';
import { constantTimeEqual } from './constantTimeEqual';

function getBearerToken(authHeader) {
  if (typeof authHeader !== 'string') {
    return '';
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token;
}

export async function requireApiToken(req, res, options = {}) {
  const {
    envVar = 'ADMIN_API_TOKEN',
    label = 'API access',
    runtime = {},
  } = options;

  const expectedToken = await getEnvValue(envVar, runtime);

  if (!expectedToken) {
    console.error(`${envVar} is not configured for ${label}`);
    res.status(503).json({
      success: false,
      message: `${label} is not configured`
    });
    return false;
  }

  const providedToken = getBearerToken(req.headers.authorization);
  if (!providedToken || !constantTimeEqual(providedToken, expectedToken)) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
    return false;
  }

  return true;
}

export function requireAdminApiToken(req, res, runtime = {}) {
  return requireApiToken(req, res, {
    envVar: 'ADMIN_API_TOKEN',
    label: 'Admin API access',
    runtime
  });
}
