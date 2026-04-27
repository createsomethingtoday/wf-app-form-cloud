import { describe, expect, it } from 'vitest';
import {
  sanitizeCloudflareLocationHeaders,
  sanitizeIncomingRequest,
} from './requestHeaderSanitizer';

describe('sanitizeCloudflareLocationHeaders', () => {
  it('normalizes non-ASCII cf-ipcity values to ASCII-safe text', () => {
    const { headers, mutated } = sanitizeCloudflareLocationHeaders(
      new Headers({ 'cf-ipcity': 'Nürnberg' })
    );

    expect(mutated).toBe(true);
    expect(headers.get('cf-ipcity')).toBe('Nurnberg');
  });

  it('normalizes non-ASCII cf-region values and preserves other headers', () => {
    const { headers, mutated } = sanitizeCloudflareLocationHeaders(
      new Headers({
        'cf-region': 'Île-de-France',
        'x-test': 'leave-me-alone',
      })
    );

    expect(mutated).toBe(true);
    expect(headers.get('cf-region')).toBe('Ile-de-France');
    expect(headers.get('x-test')).toBe('leave-me-alone');
  });

  it('leaves ASCII-only headers untouched', () => {
    const original = new Headers({ 'cf-ipcity': 'Nurnberg' });
    const { headers, mutated } = sanitizeCloudflareLocationHeaders(original);

    expect(mutated).toBe(false);
    expect(headers.get('cf-ipcity')).toBe('Nurnberg');
  });
});

describe('sanitizeIncomingRequest', () => {
  it('returns the same request when no problematic location header is present', () => {
    const request = new Request('https://example.com', {
      headers: { 'cf-ipcity': 'Nurnberg' },
    });

    expect(sanitizeIncomingRequest(request)).toBe(request);
  });

  it('clones the request when a Cloudflare location header needs sanitizing', () => {
    const request = new Request('https://example.com', {
      headers: { 'cf-ipcity': 'Nürnberg' },
    });

    const sanitized = sanitizeIncomingRequest(request);

    expect(sanitized).not.toBe(request);
    expect(sanitized.headers.get('cf-ipcity')).toBe('Nurnberg');
  });

  it('falls back to URL-based cloning for request-like App Router objects', async () => {
    const request = {
      url: 'https://example.com/api/submit-form',
      method: 'POST',
      headers: {
        entries: function* entries() {
          yield ['cf-ipcity', 'Wrocław'];
        },
      },
      body: 'payload',
    };

    const sanitized = sanitizeIncomingRequest(request);

    expect(sanitized).toBeInstanceOf(Request);
    expect(sanitized.url).toBe('https://example.com/api/submit-form');
    expect(sanitized.method).toBe('POST');
    expect(sanitized.headers.get('cf-ipcity')).toBe('Wrocaw');
    await expect(sanitized.text()).resolves.toBe('payload');
  });
});
