import { beforeEach, describe, expect, it, vi } from 'vitest';
import dispatchRequest from '../src/core/request';
import { MemoryCache } from '../src/helpers/memoryCache';

/**
 * The cache used to be written before `settle()` ran, and cache hits skipped `settle()`
 * entirely. A 500 was therefore stored and replayed to later callers as a *resolved*
 * success, bypassing `validateStatus` completely.
 */
describe('cache interaction with validateStatus', () => {
  let cache: MemoryCache;
  let fetchCalls: number;
  const ok2xx = (status: number) => status >= 200 && status < 300;

  function serve(status: number, body: Record<string, unknown> = { ok: true }) {
    fetchCalls = 0;
    global.fetch = vi.fn(() => {
      fetchCalls++;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }) as any;
  }

  const req = (extra: Record<string, unknown> = {}) => ({
    url: 'https://api.test.com/thing',
    method: 'get',
    cache,
    validateStatus: ok2xx,
    ...extra,
  });

  beforeEach(() => {
    cache = new MemoryCache();
    fetchCalls = 0;
  });

  it('does not cache a 500', async () => {
    serve(500);
    await expect(dispatchRequest(req())).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE' });
    await expect(dispatchRequest(req())).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE' });
    // Both calls must reach the network; nothing was stored.
    expect(fetchCalls).toBe(2);
  });

  it('does not cache a 404', async () => {
    serve(404);
    await expect(dispatchRequest(req())).rejects.toMatchObject({ code: 'ERR_BAD_REQUEST' });
    await expect(dispatchRequest(req())).rejects.toMatchObject({ code: 'ERR_BAD_REQUEST' });
    expect(fetchCalls).toBe(2);
  });

  it('still caches a 200', async () => {
    serve(200, { value: 42 });
    const first = await dispatchRequest(req());
    const second = await dispatchRequest(req());
    expect(fetchCalls).toBe(1);
    expect((first.data as any).value).toBe(42);
    expect((second.data as any).value).toBe(42);
  });

  it('applies validateStatus to a replayed cache hit', async () => {
    serve(299);
    // Stored under a permissive validateStatus...
    await dispatchRequest(req({ validateStatus: ok2xx }));
    expect(fetchCalls).toBe(1);

    // ...and rejected when a later caller tightens it, rather than resolving blindly.
    await expect(
      dispatchRequest(req({ validateStatus: (s: number) => s === 200 })),
    ).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE' });
  });

  it('a custom validateStatus that accepts 500 caches it as a success', async () => {
    serve(500);
    const permissive = req({ validateStatus: () => true });
    const first = await dispatchRequest(permissive);
    const second = await dispatchRequest(permissive);
    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(fetchCalls).toBe(1);
  });

  it('applies config.schema to a replayed cache hit, not just the call that populated it', async () => {
    serve(200, { id: 1 });
    // Populated without a schema...
    await dispatchRequest(req());
    expect(fetchCalls).toBe(1);

    // ...and a later caller's schema is still enforced against the cached data.
    const schema = { parse: vi.fn((data: any) => ({ ...data, parsed: true })) };
    const second = await dispatchRequest(req({ schema }));
    expect(schema.parse).toHaveBeenCalled();
    expect((second.data as any).parsed).toBe(true);
    expect(fetchCalls).toBe(1);
  });

  it('rejects a cache hit whose schema fails, without hitting the network again', async () => {
    serve(200, { id: 1 });
    await dispatchRequest(req());
    expect(fetchCalls).toBe(1);

    const failingSchema = {
      parse: vi.fn(() => {
        throw new Error('Validation failed');
      }),
    };
    await expect(dispatchRequest(req({ schema: failingSchema }))).rejects.toMatchObject({
      isAccessioError: true,
      code: 'ERR_BAD_RESPONSE',
    });
    expect(fetchCalls).toBe(1);
  });

  it('invokes hooks.onRequestError when a cache hit fails validateStatus', async () => {
    serve(299);
    await dispatchRequest(req({ validateStatus: ok2xx }));
    expect(fetchCalls).toBe(1);

    const onRequestError = vi.fn();
    await expect(
      dispatchRequest(
        req({
          validateStatus: (s: number) => s === 200,
          hooks: { onRequestError },
        }),
      ),
    ).rejects.toMatchObject({ code: 'ERR_BAD_RESPONSE' });
    expect(onRequestError).toHaveBeenCalledTimes(1);
    expect(onRequestError.mock.calls[0][0]).toMatchObject({ code: 'ERR_BAD_RESPONSE' });
  });

  it('invokes hooks.onRequestResponse on a cache hit that resolves', async () => {
    serve(200, { id: 1 });
    await dispatchRequest(req());
    expect(fetchCalls).toBe(1);

    const onRequestResponse = vi.fn();
    await dispatchRequest(req({ hooks: { onRequestResponse } }));
    expect(onRequestResponse).toHaveBeenCalledTimes(1);
  });
});

describe('response cloning is scoped to shared values', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ nested: { n: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ) as any;
  });

  it('does not deep-clone when neither cache nor dedupe is enabled', async () => {
    const spy = vi.spyOn(globalThis, 'structuredClone');
    await dispatchRequest({ url: 'https://api.test.com/plain', method: 'get' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('isolates a cached entry from later mutation of the returned response', async () => {
    const cache = new MemoryCache();
    const first = await dispatchRequest({
      url: 'https://api.test.com/mutate',
      method: 'get',
      cache,
      validateStatus: (s: number) => s < 300,
    });
    (first.data as any).nested.n = 999;

    const second = await dispatchRequest({
      url: 'https://api.test.com/mutate',
      method: 'get',
      cache,
      validateStatus: (s: number) => s < 300,
    });
    expect((second.data as any).nested.n).toBe(1);
  });
});
