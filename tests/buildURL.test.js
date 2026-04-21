import { describe, it, expect } from 'vitest';
import buildURL, { serializeParams, combineURLs, isAbsoluteURL } from '../src/core/buildURL.js';

describe('buildURL', () => {
  it('returns the url as-is when no baseURL or params', () => {
    expect(buildURL('/users')).toBe('/users');
  });

  it('combines baseURL and relative URL', () => {
    expect(buildURL('/users', 'https://api.example.com')).toBe('https://api.example.com/users');
  });

  it('removes duplicate slashes when combining', () => {
    expect(buildURL('/users/', 'https://api.example.com/')).toBe('https://api.example.com/users/');
  });

  it('does not prepend baseURL when url is absolute', () => {
    expect(buildURL('https://other.com/users', 'https://api.example.com')).toBe('https://other.com/users');
  });

  it('appends params as query string', () => {
    const result = buildURL('/users', undefined, { page: 1, limit: 10 });
    expect(result).toBe('/users?page=1&limit=10');
  });

  it('appends params to URL that already has query params', () => {
    const result = buildURL('/users?sort=name', undefined, { page: 1 });
    expect(result).toBe('/users?sort=name&page=1');
  });

  it('strips hash before appending params', () => {
    const result = buildURL('/users#section', undefined, { page: 1 });
    expect(result).toBe('/users?page=1');
  });

  it('uses custom paramsSerializer', () => {
    const serializer = (params) => `custom=${Object.keys(params).join(',')}`;
    const result = buildURL('/users', undefined, { a: 1, b: 2 }, serializer);
    expect(result).toBe('/users?custom=a,b');
  });

  it('returns empty string when no url and no baseURL', () => {
    expect(buildURL(undefined)).toBe('');
  });
});

describe('serializeParams', () => {
  it('returns empty string for null/undefined', () => {
    expect(serializeParams(null)).toBe('');
    expect(serializeParams(undefined)).toBe('');
  });

  it('serializes simple key-value pairs', () => {
    expect(serializeParams({ foo: 'bar', baz: 42 })).toBe('foo=bar&baz=42');
  });

  it('skips null and undefined values', () => {
    expect(serializeParams({ a: 1, b: null, c: undefined, d: 2 })).toBe('a=1&d=2');
  });

  it('serializes arrays', () => {
    const result = serializeParams({ tags: ['a', 'b'] });
    expect(result).toBe('tags%5B%5D=a&tags%5B%5D=b');
  });

  it('serializes nested objects', () => {
    const result = serializeParams({ filter: { status: 'active' } });
    expect(result).toBe('filter%5Bstatus%5D=active');
  });

  it('serializes Date to ISO string', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    const result = serializeParams({ date });
    expect(result).toBe('date=2025-01-01T00%3A00%3A00.000Z');
  });
});

describe('combineURLs', () => {
  it('returns relativeURL when baseURL is empty', () => {
    expect(combineURLs('', '/users')).toBe('/users');
  });

  it('returns baseURL when relativeURL is empty', () => {
    expect(combineURLs('https://api.example.com', '')).toBe('https://api.example.com');
  });

  it('combines and normalizes slashes', () => {
    expect(combineURLs('https://api.example.com/', '/users')).toBe('https://api.example.com/users');
  });
});

describe('isAbsoluteURL', () => {
  it('detects http URLs', () => {
    expect(isAbsoluteURL('http://example.com')).toBe(true);
  });

  it('detects https URLs', () => {
    expect(isAbsoluteURL('https://example.com')).toBe(true);
  });

  it('detects protocol-relative URLs', () => {
    expect(isAbsoluteURL('//example.com')).toBe(true);
  });

  it('returns false for relative URLs', () => {
    expect(isAbsoluteURL('/users')).toBe(false);
    expect(isAbsoluteURL('users')).toBe(false);
  });
});
