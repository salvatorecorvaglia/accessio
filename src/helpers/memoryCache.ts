import type { CacheProvider } from '../types';

class MemoryCache implements CacheProvider {
  private cache = new Map<string, { value: any; expiry: number | null }>();

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
    const expiry = ttl ? Date.now() + ttl : null;
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
