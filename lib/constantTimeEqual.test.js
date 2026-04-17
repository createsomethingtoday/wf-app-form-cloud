import { describe, expect, it } from 'vitest';
import { constantTimeEqual } from './constantTimeEqual';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false when strings differ in a single character', () => {
    expect(constantTimeEqual('secret', 'secrit')).toBe(false);
  });

  it('returns false when lengths differ', () => {
    expect(constantTimeEqual('short', 'shorter')).toBe(false);
    expect(constantTimeEqual('', 'a')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('rejects non-string inputs without throwing', () => {
    expect(constantTimeEqual(null, 'x')).toBe(false);
    expect(constantTimeEqual('x', null)).toBe(false);
    expect(constantTimeEqual(undefined, undefined)).toBe(false);
    expect(constantTimeEqual(123, '123')).toBe(false);
    expect(constantTimeEqual({}, {})).toBe(false);
  });

  it('handles multi-byte UTF-8 content correctly', () => {
    expect(constantTimeEqual('café', 'café')).toBe(true);
    expect(constantTimeEqual('café', 'cafe')).toBe(false);
  });
});
