import { describe, expect, it } from 'vitest';
import { hasR2Config } from './r2Client';

describe('hasR2Config', () => {
  const fullEnv = {
    CF_R2_ACCESS_KEY_ID: 'ak',
    CF_R2_SECRET_ACCESS_KEY: 'sk',
    CF_R2_BUCKET: 'bucket',
    CF_ACCOUNT_ID: 'acct',
  };

  it('returns true when all required vars resolve via fallback', () => {
    expect(hasR2Config({ env: fullEnv })).toBe(true);
  });

  it('returns true when CF_R2_ACCOUNT_ID is set explicitly', () => {
    expect(
      hasR2Config({
        env: { ...fullEnv, CF_R2_ACCOUNT_ID: 'r2-acct', CF_ACCOUNT_ID: undefined },
      })
    ).toBe(true);
  });

  it('returns false when neither CF_R2_ACCOUNT_ID nor CF_ACCOUNT_ID is set', () => {
    expect(hasR2Config({ env: { ...fullEnv, CF_ACCOUNT_ID: undefined } })).toBe(false);
  });

  it('returns false when access keys are missing', () => {
    expect(
      hasR2Config({ env: { ...fullEnv, CF_R2_ACCESS_KEY_ID: undefined } })
    ).toBe(false);
    expect(
      hasR2Config({ env: { ...fullEnv, CF_R2_SECRET_ACCESS_KEY: undefined } })
    ).toBe(false);
  });

  it('returns false when bucket is missing', () => {
    expect(hasR2Config({ env: { ...fullEnv, CF_R2_BUCKET: undefined } })).toBe(false);
  });
});
