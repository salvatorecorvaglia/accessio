import { describe, it, expect } from 'vitest';
import mergeConfig, { deepMerge } from '../src/core/mergeConfig.js';

describe('mergeConfig', () => {
  it('returns config2 values when both are provided', () => {
    const result = mergeConfig(
      { baseURL: 'https://old.com', timeout: 1000 },
      { baseURL: 'https://new.com', timeout: 5000 }
    );
    expect(result.baseURL).toBe('https://new.com');
    expect(result.timeout).toBe(5000);
  });

  it('falls back to config1 when config2 key is undefined', () => {
    const result = mergeConfig(
      { baseURL: 'https://api.com', timeout: 3000 },
      {}
    );
    expect(result.baseURL).toBe('https://api.com');
    expect(result.timeout).toBe(3000);
  });

  it('takes url, method, data only from config2', () => {
    const result = mergeConfig(
      { url: '/old', method: 'get', data: { old: true } },
      { url: '/new', method: 'post', data: { new: true } }
    );
    expect(result.url).toBe('/new');
    expect(result.method).toBe('post');
    expect(result.data).toEqual({ new: true });
  });

  it('ignores url/data from config1 if not in config2 but inherits method', () => {
    const result = mergeConfig(
      { url: '/old', method: 'get', data: { a: 1 } },
      {}
    );
    expect(result.url).toBeUndefined();
    expect(result.data).toBeUndefined();
    expect(result.method).toBe('get');
  });

  it('deep merges headers', () => {
    const result = mergeConfig(
      { headers: { common: { Accept: 'application/json' }, 'X-Default': 'yes' } },
      { headers: { common: { Authorization: 'Bearer tok' }, 'X-Custom': 'val' } }
    );
    expect(result.headers.common.Accept).toBe('application/json');
    expect(result.headers.common.Authorization).toBe('Bearer tok');
    expect(result.headers['X-Default']).toBe('yes');
    expect(result.headers['X-Custom']).toBe('val');
  });

  it('handles empty configs', () => {
    const result = mergeConfig({}, {});
    expect(result).toEqual({});
  });

  it('handles undefined configs', () => {
    const result = mergeConfig();
    expect(result).toEqual({});
  });
});

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('overrides values from later sources', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('deeply merges nested objects', () => {
    const result = deepMerge({ nested: { a: 1 } }, { nested: { b: 2 } });
    expect(result).toEqual({ nested: { a: 1, b: 2 } });
  });

  it('replaces arrays instead of merging', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4] });
    expect(result.arr).toEqual([3, 4]);
  });

  it('preserves Date instances by reference', () => {
    const date = new Date('2025-06-01');
    const result = deepMerge({}, { created: date });
    expect(result.created).toBe(date);
    expect(result.created instanceof Date).toBe(true);
  });

  it('preserves RegExp instances by reference', () => {
    const re = /test/gi;
    const result = deepMerge({}, { pattern: re });
    expect(result.pattern).toBe(re);
    expect(result.pattern instanceof RegExp).toBe(true);
  });

  it('preserves Map instances by reference', () => {
    const map = new Map([['key', 'value']]);
    const result = deepMerge({}, { data: map });
    expect(result.data).toBe(map);
  });

  it('preserves Set instances by reference', () => {
    const set = new Set([1, 2, 3]);
    const result = deepMerge({}, { items: set });
    expect(result.items).toBe(set);
  });

  it('skips undefined values', () => {
    const result = deepMerge({ a: 1 }, { a: undefined });
    expect(result.a).toBe(1);
  });

  it('ignores non-object sources', () => {
    const result = deepMerge({ a: 1 }, null, undefined, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });
});
