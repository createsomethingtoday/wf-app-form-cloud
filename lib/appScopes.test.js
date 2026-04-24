import { describe, expect, it } from 'vitest';
import {
  areAppScopesEqual,
  formatAppScopeSummary,
  normalizeAppScopes,
} from './appScopes';

describe('normalizeAppScopes', () => {
  it('normalizes JSON string arrays of scope ids into structured scope objects', () => {
    expect(normalizeAppScopes('["assets","site-activity"]')).toEqual([
      { id: 'assets', name: 'Assets', access: 'read' },
      { id: 'site-activity', name: 'Site activity', access: 'read' },
    ]);
  });

  it('preserves explicit access levels from structured scope objects', () => {
    expect(normalizeAppScopes([
      { id: 'assets', access: 'read-write' },
      { name: 'Authorized user' },
    ])).toEqual([
      { id: 'assets', name: 'Assets', access: 'read-write' },
      { id: 'authorized-user', name: 'Authorized user', access: 'read' },
    ]);
  });

  it('maps legacy comma-delimited scope labels to canonical ids', () => {
    expect(normalizeAppScopes('Assets, Branches')).toEqual([
      { id: 'assets', name: 'Assets', access: 'read' },
      { id: 'branches', name: 'Branches', access: 'read' },
    ]);
  });

  it('drops no-access entries because they should not be submitted as requested scopes', () => {
    expect(normalizeAppScopes([
      { id: 'cloud-apps', access: 'no-access' },
      { id: 'assets', access: 'read-write' },
    ])).toEqual([
      { id: 'assets', name: 'Assets', access: 'read-write' },
    ]);
  });
});

describe('areAppScopesEqual', () => {
  it('compares scopes by canonical id and access rather than raw input shape', () => {
    expect(areAppScopesEqual(
      [{ id: 'assets', access: 'read-write' }, { id: 'site-activity', access: 'read' }],
      [{ name: 'Site activity', access: 'read-only' }, { name: 'Assets', access: 'read and write' }]
    )).toBe(true);
  });
});

describe('formatAppScopeSummary', () => {
  it('renders reviewer-friendly scope summaries', () => {
    expect(formatAppScopeSummary({ id: 'assets', access: 'read-write' })).toBe(
      'Assets (Read and write)'
    );
  });
});
