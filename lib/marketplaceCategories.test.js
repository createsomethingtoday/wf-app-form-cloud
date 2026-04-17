import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_APP_CATEGORIES,
  MAX_MARKETPLACE_APP_CATEGORIES,
  findInvalidMarketplaceAppCategories,
  normalizeMarketplaceAppCategories,
} from './marketplaceCategories';

describe('normalizeMarketplaceAppCategories', () => {
  it('returns an empty array for null, undefined, or non-string values', () => {
    expect(normalizeMarketplaceAppCategories(null)).toEqual([]);
    expect(normalizeMarketplaceAppCategories(undefined)).toEqual([]);
    expect(normalizeMarketplaceAppCategories(42)).toEqual([]);
  });

  it('wraps a single non-empty string in an array', () => {
    expect(normalizeMarketplaceAppCategories('AI')).toEqual(['AI']);
  });

  it('trims surrounding whitespace from a single string', () => {
    expect(normalizeMarketplaceAppCategories('  AI  ')).toEqual(['AI']);
  });

  it('returns an empty array for a whitespace-only string', () => {
    expect(normalizeMarketplaceAppCategories('   ')).toEqual([]);
  });

  it('trims every entry in an array', () => {
    expect(normalizeMarketplaceAppCategories([' AI', 'Analytics '])).toEqual(['AI', 'Analytics']);
  });

  it('drops empty entries from an array', () => {
    expect(normalizeMarketplaceAppCategories(['AI', '', '   ', 'Marketing'])).toEqual(['AI', 'Marketing']);
  });

  it('deduplicates identical entries after trimming', () => {
    expect(normalizeMarketplaceAppCategories(['AI', ' AI ', 'AI'])).toEqual(['AI']);
  });
});

describe('findInvalidMarketplaceAppCategories', () => {
  it('returns an empty array when all values are in the canonical list', () => {
    expect(findInvalidMarketplaceAppCategories(['AI', 'Marketing'])).toEqual([]);
  });

  it('flags categories that are not in the canonical list', () => {
    expect(findInvalidMarketplaceAppCategories(['AI', 'Blockchain'])).toEqual(['Blockchain']);
  });

  it('flags mis-cased entries (matching is exact)', () => {
    expect(findInvalidMarketplaceAppCategories(['ai'])).toEqual(['ai']);
  });

  it('returns an empty array for an empty input', () => {
    expect(findInvalidMarketplaceAppCategories([])).toEqual([]);
  });
});

describe('constants', () => {
  it('exposes a non-empty list of categories', () => {
    expect(MARKETPLACE_APP_CATEGORIES.length).toBeGreaterThan(0);
    expect(new Set(MARKETPLACE_APP_CATEGORIES).size).toBe(MARKETPLACE_APP_CATEGORIES.length);
  });

  it('caps app-category selection at a small positive number', () => {
    expect(MAX_MARKETPLACE_APP_CATEGORIES).toBeGreaterThan(0);
    expect(MAX_MARKETPLACE_APP_CATEGORIES).toBeLessThan(MARKETPLACE_APP_CATEGORIES.length);
  });
});
