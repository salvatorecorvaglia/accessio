import { describe, expect, it, vi } from 'vitest';
import Accessio from '../src/accessio';
import AccessioError from '../src/core/accessioError';
import mergeConfig from '../src/core/mergeConfig';

describe('Regression & Enhancements v3 Tests', () => {
  describe('Deduplication independent abort signals', () => {
    it('allows one deduplicated caller to abort without affecting another caller', async () => {
      const client = new Accessio();

      let resolveFetch: (res: any) => void = () => {};
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              status: 200,
              statusText: 'OK',
              headers: new Headers({ 'content-type': 'application/json' }),
              text: () => Promise.resolve('{"data": "success"}'),
            });
        });
      });

      const ctrlA = new AbortController();
      const ctrlB = new AbortController();

      const pA = client.request({
        url: '/shared-resource',
        dedupe: true,
        signal: ctrlA.signal,
      });

      const pB = client.request({
        url: '/shared-resource',
        dedupe: true,
        signal: ctrlB.signal,
      });

      // Abort only request A
      ctrlA.abort('aborted A');

      // Request A should be rejected with cancellation error
      await expect(pA).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_CANCELED',
        message: 'aborted A',
      });

      // Resolve the fetch promise
      resolveFetch({});

      // Request B should succeed normally since it was not aborted
      const resB = await pB;
      expect(resB.data).toEqual({ data: 'success' });
    });
  });

  describe('autoPaginate parameter preservation and custom items selectors', () => {
    it('preserves persistent query params while stripping pagination overlaps', async () => {
      const client = new Accessio();
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve(JSON.stringify({ data: [1], next: '/page2?page=2' })),
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve(JSON.stringify({ data: [2], next: null })),
        });
      global.fetch = mockFetch;

      const items: any[] = [];
      const generator = client.autoPaginate('/test', {
        params: { apiKey: 'secret-key', page: 1 },
      });

      for await (const item of generator) {
        items.push(item);
      }

      expect(items).toEqual([1, 2]);

      // First call should have page=1 and apiKey=secret-key
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('apiKey=secret-key'),
        expect.anything(),
      );
      expect(mockFetch.mock.calls[0][0]).toContain('page=1');

      // Second call should have page=2 from nextUrl, and KEEP apiKey=secret-key, but REMOVE page=1
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/page2?page=2'),
        expect.anything(),
      );
      expect(mockFetch.mock.calls[1][0]).toContain('apiKey=secret-key');
      expect(mockFetch.mock.calls[1][0]).not.toContain('page=1');
    });

    it('supports custom string-based item key pagination extraction', async () => {
      const client = new Accessio();
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve(JSON.stringify({ results: [100, 200] })),
      });

      const items: any[] = [];
      for await (const item of client.autoPaginate('/test', { paginateItems: 'results' })) {
        items.push(item);
      }

      expect(items).toEqual([100, 200]);
    });

    it('supports custom function-based item pagination extraction', async () => {
      const client = new Accessio();
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve(JSON.stringify({ nested: { array: ['foo', 'bar'] } })),
      });

      const items: any[] = [];
      for await (const item of client.autoPaginate('/test', {
        paginateItems: (data) => data.nested.array,
      })) {
        items.push(item);
      }

      expect(items).toEqual(['foo', 'bar']);
    });
  });

  describe('maxContentLength chunked stream validation', () => {
    it('aborts chunked stream responses if size exceeds maxContentLength', async () => {
      const client = new Accessio();
      const encoder = new TextEncoder();

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('12345'));
          controller.enqueue(encoder.encode('67890'));
          controller.enqueue(encoder.encode('exceeded_chunk'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(), // No Content-Length header to simulate chunked transfer
        body: mockStream,
      });

      const p = client.request({
        url: '/chunked-limit',
        maxContentLength: 10,
        responseType: 'text',
      });

      await expect(p).rejects.toThrow('maxContentLength size of 10 exceeded');
    });
  });

  describe('Synchronous request interceptors returning Promises', () => {
    it('throws a descriptive AccessioError if a synchronous request interceptor returns a Promise', async () => {
      const client = new Accessio();
      client.interceptors.request.use(
        async (cfg) => {
          return cfg;
        },
        null,
        { synchronous: true },
      );

      const p = client.get('/test');
      await expect(p).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_OPTION',
        message: 'Synchronous request interceptors cannot return a Promise.',
      });
    });
  });

  describe('Plain text streaming fallback support', () => {
    it('yields raw lines when stream contains non-SSE / non-JSON content', async () => {
      const client = new Accessio();
      const encoder = new TextEncoder();

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('raw plain line 1\n'));
          controller.enqueue(encoder.encode('raw plain line 2\n'));
          controller.close();
        },
      });

      vi.spyOn(client, 'request').mockResolvedValue({
        data: mockStream,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {} as any,
        duration: 0,
      });

      const items: any[] = [];
      for await (const chunk of client.stream('/text-stream')) {
        items.push(chunk);
      }

      expect(items).toEqual(['raw plain line 1', 'raw plain line 2']);
    });
  });

  describe('Merged configurations prototype methods availability', () => {
    it('ensures configuration objects returned support hasOwnProperty checks', () => {
      const config = mergeConfig(
        { baseURL: 'https://api.com', headers: { common: { 'X-Test': '1' } } },
        { timeout: 5000 },
      );

      expect(config.hasOwnProperty).toBeDefined();
      // biome-ignore lint/suspicious/noPrototypeBuiltins: testing direct hasOwnProperty access
      expect(config.hasOwnProperty('baseURL')).toBe(true);
      // biome-ignore lint/suspicious/noPrototypeBuiltins: testing direct hasOwnProperty access
      expect(config.hasOwnProperty('timeout')).toBe(true);
      // biome-ignore lint/suspicious/noPrototypeBuiltins: testing direct hasOwnProperty access
      expect(config.hasOwnProperty('headers')).toBe(true);
      // biome-ignore lint/suspicious/noPrototypeBuiltins: testing direct hasOwnProperty access
      expect(config.hasOwnProperty('nonexistent')).toBe(false);
    });
  });
});
