import { describe, it, expect, vi } from 'vitest';
import Accessio from '../src/accessio';
import { toFormData } from '../src/helpers/toFormData';
import retryRequest from '../src/core/retry';
import AccessioError from '../src/core/accessioError';
import createRateLimiter from '../src/helpers/rateLimiter';

describe('Bugs & Regression Fixes Tests', () => {
  describe('autoPaginate with null or non-object response data', () => {
    it('handles null response data gracefully', async () => {
      const client = new Accessio();
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('null'),
      });
      global.fetch = mockFetch;

      const items: any[] = [];
      for await (const item of client.autoPaginate('/test')) {
        items.push(item);
      }

      expect(items).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles empty/non-object response data gracefully', async () => {
      const client = new Accessio();
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      const items: any[] = [];
      for await (const item of client.autoPaginate('/test')) {
        items.push(item);
      }

      expect(items).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('paginates when valid data is present', async () => {
      const client = new Accessio();
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve(JSON.stringify({ data: [1, 2], next: '/page2' })),
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: () => Promise.resolve(JSON.stringify({ data: [3], next: null })),
        });
      global.fetch = mockFetch;

      const items: any[] = [];
      for await (const item of client.autoPaginate('/test')) {
        items.push(item);
      }

      expect(items).toEqual([1, 2, 3]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('toFormData safety in environments without File or Blob', () => {
    it('serializes data without throwing ReferenceError', () => {
      // Save global references
      const originalFile = (global as any).File;
      const originalBlob = (global as any).Blob;

      try {
        // Delete global references to simulate environment without them
        delete (global as any).File;
        delete (global as any).Blob;

        const data = {
          name: 'test',
          nested: {
            value: 42,
          },
        };

        // Custom mock FormData because browser FormData might not exist or might behave differently in Node
        class MockFormData {
          data: Record<string, any> = {};
          append(key: string, val: any) {
            this.data[key] = val;
          }
        }
        const mockForm = new MockFormData() as any;

        const result = toFormData(data, mockForm);
        expect(result).toBeDefined();
        expect((result as any).data).toEqual({
          name: 'test',
          'nested.value': 42,
        });
      } finally {
        // Restore global references
        if (originalFile !== undefined) (global as any).File = originalFile;
        if (originalBlob !== undefined) (global as any).Blob = originalBlob;
      }
    });
  });

  describe('retryRequest with retry: 0 and retryOn429: true', () => {
    it('does not retry non-429 errors', async () => {
      const dispatch = vi
        .fn()
        .mockRejectedValue(
          new AccessioError('network error', AccessioError.ERR_NETWORK, null, null, null),
        );

      const config = { retry: 0, retryOn429: true };

      await expect(retryRequest(dispatch, config)).rejects.toThrow('network error');
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('retries 429 errors up to 3 times', async () => {
      const err = new AccessioError(
        'rate limited',
        AccessioError.ERR_BAD_REQUEST,
        { retryOn429: true } as any,
        null,
        null,
      );
      Object.defineProperty(err, 'response', {
        value: {
          status: 429,
          headers: {},
          data: null,
          config: {},
          request: {},
          duration: 0,
          statusText: 'Too Many Requests',
        },
      });

      const dispatch = vi.fn().mockRejectedValue(err);
      const config = { retry: 0, retryOn429: true, retryDelay: 1 };

      await expect(retryRequest(dispatch, config)).rejects.toThrow('rate limited');
      // Should run once initially + 3 retries = 4 attempts total
      expect(dispatch).toHaveBeenCalledTimes(4);
    });
  });

  describe('redaction in AccessioError', () => {
    it('redacts sensitive query params in error config', () => {
      const config = {
        url: '/test',
        params: {
          username: 'user',
          password: 'secret_password',
          api_key: 'secret_key',
          token: 'secret_token',
          safe: 'public_value',
        },
      };

      const error = new AccessioError('fail', 'ERR_FAIL', config, null, null);

      expect(error.config?.params).toEqual({
        username: 'user',
        password: '[REDACTED]',
        api_key: '[REDACTED]',
        token: '[REDACTED]',
        safe: 'public_value',
      });
    });

    it('redacts inline credentials in URLs', () => {
      const config1 = { url: 'https://user:password@api.example.com/v1/resource' };
      const error1 = new AccessioError('fail', 'ERR_FAIL', config1, null, null);
      expect(error1.config?.url).toBe('https://user:[REDACTED]@api.example.com/v1/resource');

      const config2 = { url: 'http://token@api.example.com/v1/resource' };
      const error2 = new AccessioError('fail', 'ERR_FAIL', config2, null, null);
      expect(error2.config?.url).toBe('http://[REDACTED]@api.example.com/v1/resource');
    });
  });

  describe('rateLimiter queue ejection on signal abort', () => {
    it('aborts queued acquires immediately and removes them from the queue', async () => {
      const limiter = createRateLimiter(1, 5);

      // Occupy the only concurrent slot
      await limiter.acquire();
      expect(limiter.active).toBe(1);
      expect(limiter.pending).toBe(0);

      // Queue up a second request with an AbortSignal
      const controller = new AbortController();
      const p1 = limiter.acquire(controller.signal);

      expect(limiter.pending).toBe(1);

      // Queue up a third request without abort signal to verify it stays queued
      const p2 = limiter.acquire();
      expect(limiter.pending).toBe(2);

      // Abort the second request
      controller.abort(new Error('Acquire aborted'));

      await expect(p1).rejects.toThrow('Acquire aborted');

      // The second request should be removed, leaving only the third request in queue
      expect(limiter.pending).toBe(1);

      // Release first slot, which should resolve p2
      limiter.release();
      await expect(p2).resolves.toBeUndefined();
      expect(limiter.active).toBe(1);
      expect(limiter.pending).toBe(0);

      limiter.release();
      expect(limiter.active).toBe(0);
    });
  });

  describe('responseType: text override', () => {
    it('returns raw text even when content-type is application/json', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"json": true}'),
      });
      global.fetch = mockFetch;

      const client = new Accessio();
      const response = await client.request({
        url: '/json-as-text',
        responseType: 'text',
      });
      expect(response.data).toBe('{"json": true}');
    });
  });

  describe('parseHeaders array flattening', () => {
    it('flattens array values instead of nesting them', async () => {
      const { default: parseHeaders } = await import('../src/helpers/parseHeaders');
      const input = {
        'Set-Cookie': ['a=1', 'b=2'],
      };
      const result = parseHeaders(input);
      expect(result['set-cookie']).toEqual(['a=1', 'b=2']);
    });
  });

  describe('flattenHeaders case-insensitive merging', () => {
    it('overwrites case-variant keys without duplication', async () => {
      const { flattenHeaders } = await import('../src/helpers/flattenHeaders');
      const headers = {
        common: {
          'Content-Type': 'application/json',
        },
        get: {
          'content-type': 'text/html',
        },
      };
      const result = flattenHeaders(headers, 'get');
      expect(Object.keys(result)).toHaveLength(1);
      expect(result['content-type']).toBe('text/html');
    });
  });

  describe('Abort reason propagation', () => {
    it('propagates the signal reason to AccessioError message and cause', async () => {
      const controller = new AbortController();
      const customError = new Error('Custom abort reason');

      const client = new Accessio();
      global.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init.signal?.aborted) {
            reject(customError);
            return;
          }
          init.signal.addEventListener('abort', () => reject(customError));
        });
      });

      const p = client.request({
        url: '/abort-test',
        signal: controller.signal,
      });

      controller.abort(customError);

      await expect(p).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_CANCELED',
        message: 'Custom abort reason',
        cause: customError,
      });
    });
  });
});
