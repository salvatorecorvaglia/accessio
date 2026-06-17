import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache, defaultMemoryCache } from '../src/helpers/memoryCache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(3); // Small size limit to easily test eviction
  });

  it('can set and get values', () => {
    cache.set('foo', 'bar');
    expect(cache.get('foo')).toBe('bar');
  });

  it('returns null for non-existent keys', () => {
    expect(cache.get('not-found')).toBeNull();
  });

  it('respects TTL and expires entries', () => {
    vi.useFakeTimers();
    try {
      cache.set('foo', 'bar', 1000);
      expect(cache.get('foo')).toBe('bar');

      vi.advanceTimersByTime(1001);
      expect(cache.get('foo')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('proactively deletes expired items when setting a new value', () => {
    vi.useFakeTimers();
    try {
      cache.set('a', 1, 1000);
      cache.set('b', 2, 5000);

      vi.advanceTimersByTime(1500);

      // 'a' is expired. Setting 'c' should trigger eviction of 'a'.
      cache.set('c', 3);

      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);

      // Accessing internal map via gets to verify eviction
      expect(cache.get('a')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts the oldest item (FIFO) when limit is exceeded', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Limit is 3. Adding 'd' should evict 'a' (oldest).
    cache.set('d', 4);

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('can delete entries', () => {
    cache.set('foo', 'bar');
    cache.delete('foo');
    expect(cache.get('foo')).toBeNull();
  });

  it('can clear the entire cache', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });

  it('defaultMemoryCache instance works', () => {
    defaultMemoryCache.set('x', 99);
    expect(defaultMemoryCache.get('x')).toBe(99);
    defaultMemoryCache.delete('x');
    expect(defaultMemoryCache.get('x')).toBeNull();
  });
});
