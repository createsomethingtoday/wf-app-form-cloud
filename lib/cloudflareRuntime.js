export function getEnvValue(name, runtime = {}) {
  if (runtime?.env && runtime.env[name] !== undefined && runtime.env[name] !== null) {
    return runtime.env[name];
  }

  if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined) {
    return process.env[name];
  }

  return undefined;
}

export function requireEnvValue(name, runtime = {}) {
  const value = getEnvValue(name, runtime);

  if (value === undefined || value === null || value === '') {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}
