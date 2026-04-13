const THEME_QUERY_KEYS = [
  'theme',
  'themeMode',
  'theme-mode',
  'color-scheme',
  'colorScheme',
  'appearance'
];

const THEME_STORAGE_KEYS = ['theme', 'color-theme', 'colorTheme'];

export function normalizeThemePreference(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'system') {
    return 'auto';
  }

  if (normalized === 'light' || normalized === 'dark' || normalized === 'auto') {
    return normalized;
  }

  return null;
}

function parseHexColor(value) {
  const normalized = value.replace('#', '').trim();

  if (normalized.length === 3) {
    return {
      r: Number.parseInt(normalized[0] + normalized[0], 16),
      g: Number.parseInt(normalized[1] + normalized[1], 16),
      b: Number.parseInt(normalized[2] + normalized[2], 16)
    };
  }

  if (normalized.length === 6) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  return null;
}

function parseRgbColor(value) {
  const match = value
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/i);

  if (!match) {
    return null;
  }

  if (match[4] !== undefined && Number.parseFloat(match[4]) === 0) {
    return null;
  }

  return {
    r: Number.parseInt(match[1], 10),
    g: Number.parseInt(match[2], 10),
    b: Number.parseInt(match[3], 10)
  };
}

function parseColor(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'transparent') {
    return null;
  }

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized);
  }

  if (normalized.startsWith('rgb')) {
    return parseRgbColor(normalized);
  }

  return null;
}

function isDarkColorValue(value) {
  const color = parseColor(value);
  if (!color) {
    return null;
  }

  const luminance = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return luminance < 140;
}

function inferThemeFromBackground(value) {
  const isDarkColor = isDarkColorValue(value);
  if (isDarkColor === null) {
    return null;
  }

  return isDarkColor ? 'dark' : 'light';
}

function inferThemeFromCssVariables(cssVariables = {}) {
  const explicitVariableKeys = ['--theme', '--color-theme', '--color-scheme'];
  for (const key of explicitVariableKeys) {
    const theme = normalizeThemePreference(cssVariables[key]);
    if (theme && theme !== 'auto') {
      return theme;
    }
  }

  const backgroundVariableKeys = [
    '--colors--background',
    '--_color---neutral--white',
    '--color-bg',
    '--webflow-background-color'
  ];

  for (const key of backgroundVariableKeys) {
    const theme = inferThemeFromBackground(cssVariables[key]);
    if (theme) {
      return theme;
    }
  }

  return null;
}

function inferThemeFromClassNames(classNames = '') {
  if (/\b(u-mode-dark|dark-mode|theme-dark|is-dark)\b/i.test(classNames)) {
    return 'dark';
  }

  if (/\b(light-mode|theme-light|is-light)\b/i.test(classNames)) {
    return 'light';
  }

  return null;
}

export function detectClientTheme(win = window) {
  const params = new URLSearchParams(win.location.search);

  for (const key of THEME_QUERY_KEYS) {
    const preference = normalizeThemePreference(params.get(key));
    if (preference && preference !== 'auto') {
      return preference;
    }
  }

  for (const key of THEME_STORAGE_KEYS) {
    try {
      const preference = normalizeThemePreference(win.localStorage.getItem(key));
      if (preference && preference !== 'auto') {
        return preference;
      }
    } catch {
      break;
    }
  }

  const root = win.document.documentElement;
  const body = win.document.body;

  const datasetCandidates = [
    root?.dataset?.theme,
    root?.dataset?.themeMode,
    root?.dataset?.colorScheme,
    body?.dataset?.theme,
    body?.dataset?.themeMode
  ];

  for (const candidate of datasetCandidates) {
    const preference = normalizeThemePreference(candidate);
    if (preference && preference !== 'auto') {
      return preference;
    }
  }

  const classTheme = inferThemeFromClassNames(
    `${root?.className || ''} ${body?.className || ''}`
  );
  if (classTheme) {
    return classTheme;
  }

  const cssVariableTheme = inferThemeFromCssVariables({
    '--colors--background': body ? win.getComputedStyle(body).backgroundColor : '',
    '--_color---neutral--white': win
      .getComputedStyle(root)
      .getPropertyValue('--_color---neutral--white')
  });
  if (cssVariableTheme) {
    return cssVariableTheme;
  }

  return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function inferThemeFromParentStyles(styles = {}) {
  const explicitTheme = normalizeThemePreference(
    styles.theme || styles.colorScheme || styles.appearance
  );
  if (explicitTheme && explicitTheme !== 'auto') {
    return explicitTheme;
  }

  const cssVariableTheme = inferThemeFromCssVariables(styles.cssVariables);
  if (cssVariableTheme) {
    return cssVariableTheme;
  }

  return inferThemeFromBackground(styles.backgroundColor);
}

export function applyThemeMode(theme, doc = document) {
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light';

  doc.documentElement.dataset.theme = resolvedTheme;
  doc.documentElement.style.colorScheme = resolvedTheme;

  if (doc.body) {
    doc.body.classList.toggle('dark-mode', resolvedTheme === 'dark');
    doc.body.classList.toggle('light-mode', resolvedTheme !== 'dark');
  }

  return resolvedTheme;
}
