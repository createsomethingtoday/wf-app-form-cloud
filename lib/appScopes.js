export const APP_SCOPE_ACCESS_LABELS = {
  read: 'Read-only',
  'read-write': 'Read and write',
};

export const APP_SCOPE_DEFINITIONS = [
  {
    id: 'app-subscriptions',
    name: 'App Subscriptions',
    description: 'View App subscriptions',
    allowedAccess: ['read'],
  },
  {
    id: 'assets',
    name: 'Assets',
    description: 'View and manage assets and folders',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'authorized-user',
    name: 'Authorized user',
    description: 'View information about the authorized user',
    allowedAccess: ['read'],
  },
  {
    id: 'branches',
    name: 'Branches',
    description: 'View and manage page branches',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'cms',
    name: 'CMS',
    description: 'View and manage CMS Collections and Items',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'comments',
    name: 'Comments',
    description: 'View and manage comments',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'components',
    name: 'Components',
    description: 'View and manage site components',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'custom-code',
    name: 'Custom Code',
    description: 'View and manage scripts for a site',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'ecommerce',
    name: 'Ecommerce',
    description: 'View and manage an Ecommerce store',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'forms',
    name: 'Forms',
    description: 'View and manage site forms and submissions',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'pages',
    name: 'Pages',
    description: 'View and manage page data',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'sites',
    name: 'Sites',
    description: 'View and manage site data and publishing',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'site-activity',
    name: 'Site activity',
    description: 'View historical site activity data',
    allowedAccess: ['read'],
  },
  {
    id: 'site-config',
    name: 'Site config',
    description: 'View and manage site configuration',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'user-accounts',
    name: 'User Accounts',
    description: 'View and manage site users and access groups',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'workspace',
    name: 'Workspace',
    description: 'View and manage Workspace resources',
    allowedAccess: ['read', 'read-write'],
  },
  {
    id: 'cloud-apps',
    name: 'Cloud Apps',
    description: 'Create and manage Webflow Cloud applications',
    allowedAccess: [],
    requestable: false,
  },
];

export const REQUESTABLE_APP_SCOPES = APP_SCOPE_DEFINITIONS.filter(
  (scope) => scope.requestable !== false && scope.allowedAccess.length > 0
);

const APP_SCOPE_DEFINITION_MAP = new Map(
  APP_SCOPE_DEFINITIONS.map((definition) => [definition.id, definition])
);

const APP_SCOPE_NAME_TO_ID = new Map(
  APP_SCOPE_DEFINITIONS.map((definition) => [definition.name.toLowerCase(), definition.id])
);

const ACCESS_ALIASES = {
  read: 'read',
  'read only': 'read',
  'read-only': 'read',
  readonly: 'read',
  'read access': 'read',
  'read-access': 'read',
  'read and write': 'read-write',
  'read and write access': 'read-write',
  'read & write': 'read-write',
  'read-write': 'read-write',
  readwrite: 'read-write',
  write: 'read-write',
  'write access': 'read-write',
  'no access': 'no-access',
  'no-access': 'no-access',
  none: 'no-access',
};

function humanizeScopeId(scopeId) {
  return String(scopeId)
    .split('-')
    .filter(Boolean)
    .map((segment) => {
      if (segment.toLowerCase() === 'cms') {
        return 'CMS';
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(' ');
}

function parseScopeString(rawScope) {
  const trimmed = String(rawScope || '').trim();

  if (!trimmed) {
    return { rawIdOrName: '', rawAccess: undefined };
  }

  const parentheticalMatch = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parentheticalMatch) {
    return {
      rawIdOrName: parentheticalMatch[1].trim(),
      rawAccess: parentheticalMatch[2].trim(),
    };
  }

  const separatorMatch = trimmed.match(/^(.*?)(?::\s*|\s+-\s+)(.+)$/);
  if (separatorMatch) {
    const possibleAccess = normalizeAccessAlias(separatorMatch[2]);
    if (possibleAccess) {
      return {
        rawIdOrName: separatorMatch[1].trim(),
        rawAccess: separatorMatch[2].trim(),
      };
    }
  }

  return { rawIdOrName: trimmed, rawAccess: undefined };
}

function normalizeAccessAlias(rawAccess) {
  if (rawAccess === undefined || rawAccess === null) {
    return null;
  }

  const normalized = String(rawAccess)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return ACCESS_ALIASES[normalized] || null;
}

function normalizeScopeId(rawIdOrName) {
  const trimmed = String(rawIdOrName || '').trim();
  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  if (APP_SCOPE_DEFINITION_MAP.has(lower)) {
    return lower;
  }

  if (APP_SCOPE_NAME_TO_ID.has(lower)) {
    return APP_SCOPE_NAME_TO_ID.get(lower);
  }

  const slug = lower.replace(/[_\s]+/g, '-');
  if (APP_SCOPE_DEFINITION_MAP.has(slug)) {
    return slug;
  }

  return slug;
}

export function getAppScopeDefinition(scopeId) {
  return APP_SCOPE_DEFINITION_MAP.get(normalizeScopeId(scopeId)) || null;
}

export function getAllowedAccessLevels(scopeId) {
  const definition = getAppScopeDefinition(scopeId);
  if (definition) {
    return definition.allowedAccess;
  }

  return ['read', 'read-write'];
}

function normalizeScopeAccess(scopeId, rawAccess) {
  const allowedAccess = getAllowedAccessLevels(scopeId);
  if (allowedAccess.length === 0) {
    return null;
  }

  const normalizedAccess = normalizeAccessAlias(rawAccess);
  if (!normalizedAccess) {
    return allowedAccess.includes('read') ? 'read' : allowedAccess[0];
  }

  if (normalizedAccess === 'no-access') {
    return null;
  }

  if (allowedAccess.includes(normalizedAccess)) {
    return normalizedAccess;
  }

  if (normalizedAccess === 'read-write' && allowedAccess.includes('read')) {
    return 'read';
  }

  return allowedAccess[0] || null;
}

export function normalizeAppScope(rawScope) {
  if (!rawScope) {
    return null;
  }

  let rawIdOrName = '';
  let rawName = '';
  let rawAccess;

  if (typeof rawScope === 'string') {
    const parsed = parseScopeString(rawScope);
    rawIdOrName = parsed.rawIdOrName;
    rawName = parsed.rawIdOrName;
    rawAccess = parsed.rawAccess;
  } else if (typeof rawScope === 'object') {
    rawIdOrName =
      rawScope.id
      || rawScope.scopeId
      || rawScope.scope
      || rawScope.key
      || rawScope.name
      || rawScope.label
      || '';
    rawName =
      typeof rawScope.name === 'string'
        ? rawScope.name.trim()
        : typeof rawScope.label === 'string'
          ? rawScope.label.trim()
          : '';
    rawAccess = rawScope.access ?? rawScope.permission ?? rawScope.level;
  } else {
    return null;
  }

  const scopeId = normalizeScopeId(rawIdOrName);
  if (!scopeId) {
    return null;
  }

  const access = normalizeScopeAccess(scopeId, rawAccess);
  if (!access) {
    return null;
  }

  const definition = getAppScopeDefinition(scopeId);

  return {
    id: scopeId,
    name: definition?.name || rawName || humanizeScopeId(scopeId),
    access,
  };
}

export function normalizeAppScopes(rawScopes) {
  if (!rawScopes) {
    return [];
  }

  let entries = [];

  if (Array.isArray(rawScopes)) {
    entries = rawScopes;
  } else if (typeof rawScopes === 'string') {
    const trimmed = rawScopes.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      entries = trimmed
        .split(/\n|,/)
        .map((scope) => scope.trim())
        .filter(Boolean);
    }
  } else {
    entries = [rawScopes];
  }

  const deduped = new Map();

  for (const entry of entries) {
    const normalized = normalizeAppScope(entry);
    if (!normalized) {
      continue;
    }

    deduped.set(normalized.id, normalized);
  }

  return Array.from(deduped.values());
}

export function areAppScopesEqual(leftScopes, rightScopes) {
  const left = normalizeAppScopes(leftScopes)
    .map((scope) => `${scope.id}:${scope.access}`)
    .sort();
  const right = normalizeAppScopes(rightScopes)
    .map((scope) => `${scope.id}:${scope.access}`)
    .sort();

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function formatAppScopeSummary(scope) {
  const normalized = normalizeAppScope(scope);
  if (!normalized) {
    return '';
  }

  return `${normalized.name} (${APP_SCOPE_ACCESS_LABELS[normalized.access] || normalized.access})`;
}
