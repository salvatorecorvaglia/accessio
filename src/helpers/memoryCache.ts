import type { CacheProvider } from '../types';

class MemoryCache implements CacheProvider {
  private cache = new Map<string, { value: any; expiry: number | null }>();
  private maxItems: number;

  constructor(maxItems: number = 1000) {
    this.maxItems = maxItems;
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: any, ttl?: number) {
    const now = Date.now();

    // Proactively evict all expired items first
    for (const [k, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        this.cache.delete(k);
      }
    }

    // Evict oldest item if we are still at limit
    if (this.cache.size >= this.maxItems) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }

    const expiry = ttl ? now + ttl : null;
    this.cache.set(key, { value, expiry });
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

export const defaultMemoryCache = new MemoryCache();
export { MemoryCache };
