import { describe, it, expect } from 'vitest';
import { createRateLimiter, rateLimitedRequest } from '../src/helpers/rateLimiter';

describe('createRateLimiter', () => {
  it('starts with zero active and pending', () => {
    const limiter = createRateLimiter(3);
    expect(limiter.active).toBe(0);
    expect(limiter.pending).toBe(0);
  });

  it('acquires slots up to maxConcurrent', async () => {
    const limiter = createRateLimiter(2);

    await limiter.acquire();
    expect(limiter.active).toBe(1);

    await limiter.acquire();
    expect(limiter.active).toBe(2);
    expect(limiter.pending).toBe(0);
  });

  it('queues when maxConcurrent is reached', async () => {
    const limiter = createRateLimiter(1);
    await limiter.acquire();
    expect(limiter.active).toBe(1);

    let resolved = false;
    const pending = limiter.acquire().then(() => { resolved = true; });
    expect(limiter.pending).toBe(1);
    expect(resolved).toBe(false);

    limiter.release();
    await pending;
    expect(resolved).toBe(true);
    expect(limiter.active).toBe(1);
    expect(limiter.pending).toBe(0);
  });

  it('releases correctly', async () => {
    const limiter = createRateLimiter(2);
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.active).toBe(2);

    limiter.release();
    expect(limiter.active).toBe(1);

    limiter.release();
    expect(limiter.active).toBe(0);
  });

  it('works with Infinity (no limit)', async () => {
    const limiter = createRateLimiter(Infinity);
    for (let i = 0; i < 100; i++) {
      await limiter.acquire();
    }
    expect(limiter.active).toBe(100);
    expect(limiter.pending).toBe(0);
  });

  it('defaults to Infinity', async () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 50; i++) {
      await limiter.acquire();
    }
    expect(limiter.active).toBe(50);
    expect(limiter.pending).toBe(0);
  });

  describe('destroy()', () => {
    it('starts as not destroyed', () => {
      const limiter = createRateLimiter(2);
      expect(limiter.destroyed).toBe(false);
    });

    it('marks the limiter as destroyed', () => {
      const limiter = createRateLimiter(2);
      limiter.destroy();
      expect(limiter.destroyed).toBe(true);
    });

    it('rejects all queued pending promises', async () => {
      const limiter = createRateLimiter(1);
      await limiter.acquire();

      const results = [
        limiter.acquire().catch(e => e.message),
        limiter.acquire().catch(e => e.message),
        limiter.acquire().catch(e => e.message),
      ];

      expect(limiter.pending).toBe(3);

      limiter.destroy();

      const messages = await Promise.all(results);
      expect(limiter.pending).toBe(0);
      for (const msg of messages) {
        expect(msg).toContain('destroyed');
      }
    });

    it('rejects new acquire() calls after destroy', async () => {
      const limiter = createRateLimiter(2);
      limiter.destroy();

      await expect(limiter.acquire()).rejects.toThrow('destroyed');
    });

    it('is idempotent — calling destroy() twice does not throw', () => {
      const limiter = createRateLimiter(2);
      expect(() => {
        limiter.destroy();
        limiter.destroy();
      }).not.toThrow();
    });
  });

  describe('rateLimitedRequest()', () => {
    it('acquires, dispatches and releases automatically', async () => {
      const limiter = createRateLimiter(2);
      const dispatch = async (config: any) => ({ status: 200, config });

      const result = await rateLimitedRequest(dispatch, limiter, { url: '/test' });
      expect(result.status).toBe(200);
      expect(limiter.active).toBe(0);
    });

    it('releases even when dispatch throws', async () => {
      const limiter = createRateLimiter(2);
      const dispatch = async () => { throw new Error('network error'); };

      await expect(rateLimitedRequest(dispatch, limiter, {})).rejects.toThrow('network error');
      expect(limiter.active).toBe(0);
    });
  });
});
