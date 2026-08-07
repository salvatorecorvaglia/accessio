import { beforeEach, describe, expect, it, vi } from 'vitest';
import Accessio from '../src/accessio';
import AccessioError from '../src/core/accessioError';
import { serializeParams } from '../src/core/buildURL';
import dispatchRequest from '../src/core/request';
import retryRequest from '../src/core/retry';
import { createRateLimiter, rateLimitedRequest } from '../src/helpers/rateLimiter';
import { toFormData } from '../src/helpers/toFormData';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('autoPaginate termination guards', () => {
  function servePages(pages: Record<string, unknown>) {
    global.fetch = vi.fn((url: any) => {
      const page = pages[String(url)];
      if (!page) throw new Error(`unexpected url ${url}`);
      return Promise.resolve(jsonResponse(page));
    }) as any;
  }

  it('rejects a next link that points back at an already-fetched page', async () => {
    servePages({
      'https://api.test.com/p1': { items: [1], next: 'https://api.test.com/p2' },
      'https://api.test.com/p2': { items: [2], next: 'https://api.test.com/p1' },
    });

    const client = new Accessio();
    const seen: number[] = [];
    await expect(
      (async () => {
        for await (const item of client.autoPaginate<number>('https://api.test.com/p1')) {
          seen.push(item);
        }
      })(),
    ).rejects.toThrow(/Pagination cycle detected/);

    // It still yielded the real pages before detecting the cycle.
    expect(seen).toEqual([1, 2]);
  });

  it('rejects a self-referential next link immediately', async () => {
    servePages({
      'https://api.test.com/loop': { items: [1], next: 'https://api.test.com/loop' },
    });
    const client = new Accessio();
    await expect(
      (async () => {
        for await (const _ of client.autoPaginate('https://api.test.com/loop')) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/Pagination cycle detected/);
  });

  it('stops at maxPages on a non-repeating but endless chain', async () => {
    let n = 0;
    global.fetch = vi.fn(() => {
      n++;
      return Promise.resolve(
        jsonResponse({ items: [n], next: `https://api.test.com/page/${n + 1}` }),
      );
    }) as any;

    const client = new Accessio();
    await expect(
      (async () => {
        for await (const _ of client.autoPaginate('https://api.test.com/page/0', {
          maxPages: 4,
        })) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/exceeded maxPages \(4\)/);
    expect(n).toBe(4);
  });

  it('completes normally when the chain ends', async () => {
    servePages({
      'https://api.test.com/a': { items: [1, 2], next: 'https://api.test.com/b' },
      'https://api.test.com/b': { items: [3], next: null },
    });
    const client = new Accessio();
    const seen: number[] = [];
    for await (const item of client.autoPaginate<number>('https://api.test.com/a')) {
      seen.push(item);
    }
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe('schema validation runs after transformResponse', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({ count: '5' }))) as any;
  });

  it('validates the transformed value, not the raw adapter output', async () => {
    const seenBySchema: unknown[] = [];
    const res = await dispatchRequest({
      url: 'https://api.test.com/x',
      method: 'get',
      transformResponse: [(data: any) => ({ count: Number(data.count) })],
      schema: {
        parse: (data: unknown) => {
          seenBySchema.push(data);
          return data;
        },
      },
    });

    expect(seenBySchema).toEqual([{ count: 5 }]);
    expect(res.data).toEqual({ count: 5 });
  });

  it('reports a status failure rather than a schema failure on a bad status', async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({ error: 'boom' }, 500))) as any;
    const schema = { parse: vi.fn(() => ({})) };

    await expect(
      dispatchRequest({
        url: 'https://api.test.com/x',
        method: 'get',
        validateStatus: (s: number) => s < 400,
        schema,
      }),
    ).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE', message: /status code 500/ });
    expect(schema.parse).not.toHaveBeenCalled();
  });

  it('surfaces a schema failure as ERR_BAD_RESPONSE', async () => {
    await expect(
      dispatchRequest({
        url: 'https://api.test.com/x',
        method: 'get',
        schema: {
          parse: () => {
            throw new Error('expected number, got string');
          },
        },
      }),
    ).rejects.toMatchObject({
      code: 'ERR_BAD_RESPONSE',
      message: 'expected number, got string',
    });
  });

  it('supports an async parseAsync schema', async () => {
    const res = await dispatchRequest({
      url: 'https://api.test.com/x',
      method: 'get',
      schema: {
        parse: () => ({ never: true }),
        parseAsync: async (data: any) => ({ parsed: data.count }),
      },
    });
    expect(res.data).toEqual({ parsed: '5' });
  });
});

describe('rate limiter cancellation is a recognisable AccessioError', () => {
  it('rejects a queued acquire with ERR_CANCELED on abort', async () => {
    const limiter = createRateLimiter(1);
    await limiter.acquire(); // occupy the only slot

    const controller = new AbortController();
    const queued = limiter.acquire(controller.signal);
    controller.abort(new Error('user cancelled'));

    const err: any = await queued.catch((e) => e);
    expect(err).toBeInstanceOf(AccessioError);
    expect(err.code).toBe('ERR_CANCELED');
    expect(err.message).toBe('user cancelled');
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('rejects with ERR_CANCELED when the signal is already aborted', async () => {
    const limiter = createRateLimiter(1);
    const controller = new AbortController();
    controller.abort();
    const err: any = await limiter.acquire(controller.signal).catch((e) => e);
    expect(err.code).toBe('ERR_CANCELED');
  });

  it('rejects pending acquires with ERR_CANCELED when destroyed', async () => {
    const limiter = createRateLimiter(1);
    await limiter.acquire();
    const queued = limiter.acquire();
    limiter.destroy();
    const err: any = await queued.catch((e) => e);
    expect(err.code).toBe('ERR_CANCELED');
    expect(err.isAccessioError).toBe(true);
  });

  it('makes a rate-limited abort visible to a retryCondition', async () => {
    const limiter = createRateLimiter(1);
    await limiter.acquire();
    const controller = new AbortController();
    controller.abort(new Error('stop'));

    const err: any = await rateLimitedRequest(() => Promise.resolve({} as any), limiter, {
      signal: controller.signal,
    }).catch((e) => e);

    // defaultRetryCondition keys off error.code; a bare Error was invisible to it.
    expect(err.code).toBe('ERR_CANCELED');
  });
});

describe('cycle guards track the current path, not every object seen', () => {
  it('serializes the same object referenced under two param keys', () => {
    const shared = { id: 1 };
    const out = serializeParams({ a: shared, b: shared });
    expect(out).toContain('a%5Bid%5D=1');
    expect(out).toContain('b%5Bid%5D=1');
  });

  it('still breaks a genuine param cycle', () => {
    const cyclic: any = { name: 'x' };
    cyclic.self = cyclic;
    expect(() => serializeParams(cyclic)).not.toThrow();
    expect(serializeParams(cyclic)).toContain('name=x');
  });

  it('appends the same object referenced under two form keys', () => {
    const shared = { id: 7 };
    const fd = toFormData({ a: shared, b: shared });
    expect(fd.get('a.id')).toBe('7');
    expect(fd.get('b.id')).toBe('7');
  });

  it('still breaks a genuine form cycle', () => {
    const cyclic: any = { name: 'x' };
    cyclic.self = cyclic;
    expect(() => toFormData(cyclic)).not.toThrow();
    expect(toFormData(cyclic).get('name')).toBe('x');
  });
});

describe('onRetry is an observer, not a failure path', () => {
  it('a throwing onRetry does not replace the error or stop retrying', async () => {
    const err = new AccessioError('network error', AccessioError.ERR_NETWORK, null, null, null);
    const dispatch = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ status: 200, data: 'ok' });

    const res = await retryRequest(dispatch, {
      retry: 3,
      retryDelay: 1,
      onRetry: () => {
        throw new Error('logger exploded');
      },
    });

    expect(res).toEqual({ status: 200, data: 'ok' });
    expect(dispatch).toHaveBeenCalledTimes(3);
  });
});

describe('instances do not share mutable default transforms', () => {
  it('mutating one instance transformRequest array leaves others untouched', () => {
    const a = new Accessio();
    const b = new Accessio();
    const before = (b.defaults.transformRequest as any[]).length;

    (a.defaults.transformRequest as any[]).push(() => 'injected');

    expect((b.defaults.transformRequest as any[]).length).toBe(before);
    expect(a.defaults.transformRequest).not.toBe(b.defaults.transformRequest);
  });

  it('an added transform still applies to the instance that added it', async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({ ok: true }))) as any;
    const client = new Accessio({ baseURL: 'https://api.test.com' });
    (client.defaults.transformRequest as any[]).push(() => 'REPLACED');

    await client.post('/x', { original: true });
    const init = (global.fetch as any).mock.calls[0][1];
    expect(init.body).toBe('REPLACED');
  });
});
