import { describe, expect, it, vi } from 'vitest';
import Accessio from '../src/accessio';
import AccessioError from '../src/core/accessioError';
import { toFormData } from '../src/helpers/toFormData';

describe('Regression Fixes v2 Tests', () => {
  describe('toFormData circular reference handling', () => {
    it('does not throw stack overflow on circular structures', () => {
      const obj: any = { name: 'parent' };
      obj.self = obj;

      const result = toFormData(obj);
      expect(result).toBeDefined();
      expect(result.append).toBeDefined();
    });
  });

  describe('Node.js stream/async iterator support in stream()', () => {
    it('consumes stream using Symbol.asyncIterator if getReader is not present', async () => {
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield 'data: {"val": 10}\n';
          yield 'data: {"val": 20}\n';
        },
      };

      const client = new Accessio();
      vi.spyOn(client, 'request').mockResolvedValue({
        data: mockAsyncIterable,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {} as any,
        duration: 0,
      });

      const items: any[] = [];
      for await (const chunk of client.stream('/test')) {
        items.push(chunk);
      }

      expect(items).toEqual([{ val: 10 }, { val: 20 }]);
    });
  });

  describe('Robust SSE carriage return trimming', () => {
    it('trims carriage returns from line endings and parses properly', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield 'data: {"text": "hello"}\r\n';
          yield 'data: [DONE]\r\n';
        },
      };

      const client = new Accessio();
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
      for await (const chunk of client.stream('/test')) {
        items.push(chunk);
      }

      expect(items).toEqual([{ text: 'hello' }]);
    });
  });

  describe('Retry sleep cancellation wrapper', () => {
    it('wraps sleep abort inside an AccessioError with ERR_CANCELED code', async () => {
      const client = new Accessio();
      const controller = new AbortController();

      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          // Fail with network error to trigger retry sleep
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve('{}'),
        });
      });

      // Start request with retry and signal
      const promise = client.request({
        url: '/retry-abort-test',
        retry: 2,
        retryDelay: 2000,
        signal: controller.signal,
      });

      // Wait a tiny bit then abort signal during retry sleep
      setTimeout(() => {
        controller.abort('User abort reason');
      }, 500);

      await expect(promise).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_CANCELED',
        message: 'User abort reason',
      });
    });
  });

  describe('Deduplicated request transforms', () => {
    it('applies independent response transforms for concurrently deduplicated requests', async () => {
      const client = new Accessio();

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"name": "Alice"}'),
      });

      const p1 = client.request({
        url: '/shared',
        dedupe: true,
        transformResponse: [(data: any) => ({ ...data, tag: 'REQ_A' })],
      });

      const p2 = client.request({
        url: '/shared',
        dedupe: true,
        transformResponse: [(data: any) => ({ ...data, tag: 'REQ_B' })],
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.data).toEqual({ name: 'Alice', tag: 'REQ_A' });
      expect(r2.data).toEqual({ name: 'Alice', tag: 'REQ_B' });
    });
  });

  describe('Cache response data mutations protection', () => {
    it('returns a separate clone from MemoryCache to prevent shared object mutation side-effects', async () => {
      const client = new Accessio();

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"items": [1, 2]}'),
      });

      // First request (populates cache)
      const res1 = await client.request({
        url: '/cached',
        cache: true,
      });

      expect(res1.data).toEqual({ items: [1, 2] });

      // Mutate returned object
      (res1.data as any).items.push(3);

      // Second request (hits cache)
      const res2 = await client.request({
        url: '/cached',
        cache: true,
      });

      // Verify cached entry was not mutated
      expect(res2.data).toEqual({ items: [1, 2] });
    });
  });
});
