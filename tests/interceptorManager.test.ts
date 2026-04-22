import { describe, it, expect } from 'vitest';
import InterceptorManager from '../src/interceptors/interceptorManager';

describe('InterceptorManager', () => {
  it('starts with no handlers', () => {
    const manager = new InterceptorManager();
    expect(manager.size).toBe(0);
  });

  describe('use', () => {
    it('registers an interceptor and returns its id', () => {
      const manager = new InterceptorManager();
      const id = manager.use((val) => val);
      expect(id).toBe(0);
      expect(manager.size).toBe(1);
    });

    it('returns incrementing ids', () => {
      const manager = new InterceptorManager();
      expect(manager.use(() => {})).toBe(0);
      expect(manager.use(() => {})).toBe(1);
      expect(manager.use(() => {})).toBe(2);
      expect(manager.size).toBe(3);
    });

    it('stores fulfilled and rejected handlers', () => {
      const manager = new InterceptorManager();
      const fulfilled = (v: any) => v;
      const rejected = (e: any) => e;
      manager.use(fulfilled, rejected);

      let captured: any;
      manager.forEach((h) => { captured = h; });
      expect(captured.fulfilled).toBe(fulfilled);
      expect(captured.rejected).toBe(rejected);
    });

    it('stores options', () => {
      const manager = new InterceptorManager();
      const runWhen = () => true;
      manager.use(() => {}, undefined, { synchronous: true, runWhen });

      let captured: any;
      manager.forEach((h) => { captured = h; });
      expect(captured.synchronous).toBe(true);
      expect(captured.runWhen).toBe(runWhen);
    });
  });

  describe('eject', () => {
    it('removes an interceptor by id', () => {
      const manager = new InterceptorManager();
      const id = manager.use(() => {});
      expect(manager.size).toBe(1);

      manager.eject(id);
      expect(manager.size).toBe(0);
    });

    it('does nothing for invalid ids', () => {
      const manager = new InterceptorManager();
      manager.use(() => {});
      manager.eject(99);
      expect(manager.size).toBe(1);
    });

    it('skips ejected handlers in forEach', () => {
      const manager = new InterceptorManager();
      const results: string[] = [];
      manager.use(() => results.push('a'));
      const id = manager.use(() => results.push('b'));
      manager.use(() => results.push('c'));

      manager.eject(id);
      manager.forEach((h) => (h as any).fulfilled());
      expect(results).toEqual(['a', 'c']);
    });
  });

  describe('clear', () => {
    it('removes all interceptors', () => {
      const manager = new InterceptorManager();
      manager.use(() => {});
      manager.use(() => {});
      manager.use(() => {});
      expect(manager.size).toBe(3);

      manager.clear();
      expect(manager.size).toBe(0);
    });
  });

  describe('forEach', () => {
    it('iterates over all active interceptors', () => {
      const manager = new InterceptorManager();
      const items: number[] = [];
      manager.use(() => items.push(1));
      manager.use(() => items.push(2));

      manager.forEach((h) => (h as any).fulfilled());
      expect(items).toEqual([1, 2]);
    });
  });
});
