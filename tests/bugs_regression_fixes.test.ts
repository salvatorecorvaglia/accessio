import { describe, expect, it, vi } from 'vitest';
import Accessio from '../src/accessio';
import AccessioError, { redactConfig } from '../src/core/accessioError';
import retryRequest from '../src/core/retry';
import { flattenHeaders } from '../src/helpers/flattenHeaders';
import { MemoryCache } from '../src/helpers/memoryCache';
import createRateLimiter from '../src/helpers/rateLimiter';
import { toFormData } from '../src/helpers/toFormData';
import transformData from '../src/helpers/transformData';
import InterceptorManager from '../src/interceptors/interceptorManager';

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
        (global as any).File = undefined;
        (global as any).Blob = undefined;

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

  describe('autoPaginate parameter preservation', () => {
    it('should not preserve initial params across pages', async () => {
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
      for await (const item of client.autoPaginate('/test', { params: { page: 1 } })) {
        items.push(item);
      }

      expect(items).toEqual([1, 2]);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('page=1'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/page2?page=2'),
        expect.anything(),
      );
      expect(mockFetch.mock.calls[1][0]).not.toContain('page=1');
    });
  });

  describe('toFormData binary data handling', () => {
    it('appends buffers and typed arrays without recursion stack overflow', () => {
      const data = {
        name: 'test',
        buffer: typeof Buffer !== 'undefined' ? Buffer.from('hello') : new Uint8Array([1, 2, 3]),
        typedArray: new Uint8Array([4, 5, 6]),
      };

      class MockFormData {
        data: Record<string, any> = {};
        append(key: string, val: any) {
          this.data[key] = val;
        }
      }
      const mockForm = new MockFormData() as any;

      const result = toFormData(data, mockForm);
      expect(result).toBeDefined();
      expect((result as any).data.name).toBe('test');
      expect((result as any).data['nested.buffer']).toBeUndefined();
    });
  });

  describe('Circular reference handling in config log/redact', () => {
    it('redacts config with circular headers/params without crashing', async () => {
      const { redactConfig } = await import('../src/core/accessioError');
      const circular: any = { key: 'val' };
      circular.self = circular;

      const config = {
        url: '/test',
        headers: {
          'x-circular': circular,
        },
        params: {
          circularParam: circular,
        },
      };

      const redacted = redactConfig(config);
      expect(redacted).toBeDefined();
      expect(redacted?.headers?.['x-circular']).toEqual({ key: 'val', self: '[Circular]' });
      expect(redacted?.params?.circularParam).toEqual({ key: 'val', self: '[Circular]' });
    });

    it('redacts large objects and arrays correctly', async () => {
      const { redactBody } = await import('../src/core/accessioError');
      const largeArray = new Array(200).fill('item');
      const largeObject: any = {};
      for (let i = 0; i < 200; i++) {
        largeObject[`key_${i}`] = 'value';
      }

      const redactedArray = redactBody(largeArray) as any[];
      expect(redactedArray.length).toBe(101);
      expect(redactedArray[100]).toContain('truncated');

      const redactedObj = redactBody(largeObject) as Record<string, any>;
      expect(Object.keys(redactedObj).length).toBe(101);
      expect(redactedObj['...']).toContain('Truncated');
    });
  });

  describe('setBasicAuth browser fallback when Buffer is undefined', () => {
    it('uses btoa for credentials encoding', async () => {
      const { setBasicAuth } = await import('../src/helpers/auth');
      const originalBuffer = (global as any).Buffer;
      try {
        (global as any).Buffer = undefined;
        const config = {
          auth: {
            username: 'user',
            password: 'password',
          },
        };
        const headers: any = {};
        setBasicAuth(config, headers);
        expect(headers.Authorization).toBe('Basic dXNlcjpwYXNzd29yZA==');
      } finally {
        (global as any).Buffer = originalBuffer;
      }
    });
  });

  describe('serializeParams circular reference safety', () => {
    it('safely skips circular references in query params without throwing RangeError', async () => {
      const { serializeParams } = await import('../src/core/buildURL');
      const circular: any = { a: 1 };
      circular.self = circular;

      const result = serializeParams(circular);
      expect(result).toBe('a=1');
    });
  });

  describe('getSetCookie support in headers parsing', () => {
    it('uses getSetCookie when available to preserve multiple Set-Cookie headers as an array', async () => {
      const { default: parseHeaders } = await import('../src/helpers/parseHeaders');
      const mockHeaders = {
        forEach(fn: any) {
          fn('foo=bar', 'Set-Cookie');
        },
        getSetCookie: () => ['foo=bar', 'baz=qux'],
      };

      const parsed = parseHeaders(mockHeaders);
      expect(parsed['set-cookie']).toEqual(['foo=bar', 'baz=qux']);
    });
  });

  describe('formSerializer brackets option support', () => {
    it('serializes nested objects using dot notation by default', async () => {
      const client = new Accessio();
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      // Custom mock FormData to extract keys
      const appendedKeys: Record<string, any> = {};
      class MockFormData {
        append(key: string, val: any) {
          appendedKeys[key] = val;
        }
      }
      const originalFormData = (global as any).FormData;
      (global as any).FormData = MockFormData;

      try {
        await client.postForm('/submit', { user: { id: 1, profile: { name: 'Bob' } } });
        expect(appendedKeys).toEqual({
          'user.id': 1,
          'user.profile.name': 'Bob',
        });
      } finally {
        (global as any).FormData = originalFormData;
      }
    });

    it('serializes nested objects using bracket notation when formSerializer.brackets is true', async () => {
      const client = new Accessio();
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      const appendedKeys: Record<string, any> = {};
      class MockFormData {
        append(key: string, val: any) {
          appendedKeys[key] = val;
        }
      }
      const originalFormData = (global as any).FormData;
      (global as any).FormData = MockFormData;

      try {
        await client.postForm(
          '/submit',
          { user: { id: 1, profile: { name: 'Bob' } } },
          {
            formSerializer: { brackets: true },
          },
        );
        expect(appendedKeys).toEqual({
          'user[id]': 1,
          'user[profile][name]': 'Bob',
        });
      } finally {
        (global as any).FormData = originalFormData;
      }
    });
  });

  describe('cacheClone option support', () => {
    it('returns a clone by default but returns the same reference when cacheClone is false', async () => {
      const client = new Accessio();
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"items": [1]}'),
      });

      // Default (cloning enabled)
      const res1 = await client.request({ url: '/cache-test', cache: true });
      const res2 = await client.request({ url: '/cache-test', cache: true });
      expect(res1.data).not.toBe(res2.data);
      expect(res1.data).toEqual(res2.data);

      // cacheClone: false (cloning disabled)
      const res3 = await client.request({
        url: '/cache-test-no-clone',
        cache: true,
        cacheClone: false,
      });
      const res4 = await client.request({
        url: '/cache-test-no-clone',
        cache: true,
        cacheClone: false,
      });
      expect(res3.data).toBe(res4.data);
    });
  });

  describe('New Analysis Fixes Verification', () => {
    it('flattenHeaders: handles primitive flat headers that collide with METHOD_KEYS or common', () => {
      const input = {
        common: 'flat-common-header',
        get: 'flat-get-header',
        'content-type': 'application/json',
      };
      const flat = flattenHeaders(input as any, 'get');
      expect(flat).toEqual({
        common: 'flat-common-header',
        get: 'flat-get-header',
        'content-type': 'application/json',
      });
    });

    it('transformData: supports a single function instead of an array', async () => {
      const fn = (data: any) => `${data}!`;
      const result = await transformData(fn, 'hello', {});
      expect(result).toBe('hello!');
    });

    it('redactURL: redacts sensitive query parameters', () => {
      const config = {
        url: 'https://example.com/api?api_key=secret-token&password=123&other=public',
      };
      const redacted = redactConfig(config);
      expect(redacted?.url).toBe(
        'https://example.com/api?api_key=[REDACTED]&password=[REDACTED]&other=public',
      );
    });

    it('fetchAdapter: upfront content-length validation check', async () => {
      const client = new Accessio();
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-length': '1000' }),
        text: () => Promise.resolve('hello'),
      });
      await expect(
        client.request({
          url: '/test',
          maxContentLength: 500,
        }),
      ).rejects.toThrow('maxContentLength size of 500 exceeded');
    });

    it('fetchAdapter: direct stream cancel triggers abort cleanup immediately', async () => {
      const client = new Accessio();
      const ctrl = new AbortController();
      let listenerRemoved = false;

      const originalRemoveEventListener = ctrl.signal.removeEventListener.bind(ctrl.signal);
      ctrl.signal.removeEventListener = (type: string, listener: any, options?: any) => {
        if (type === 'abort') {
          listenerRemoved = true;
        }
        return originalRemoveEventListener(type, listener, options);
      };

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk'));
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockStream,
      });

      const res = await client.request({
        url: '/stream-cancel-test',
        responseType: 'stream',
        signal: ctrl.signal,
        timeout: 5000,
      });

      expect(listenerRemoved).toBe(false);

      // Directly cancel the stream
      await res.data.cancel();

      expect(listenerRemoved).toBe(true);
    });

    it('MemoryCache: moves updated key to the end of insertion order', () => {
      const cache = new MemoryCache(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Updating 'a' should make it the newest insertion
      cache.set('a', 10);

      // Adding 'd' should evict 'b' (which is now the oldest) instead of 'a'
      cache.set('d', 4);

      expect(cache.get('b')).toBeNull();
      expect(cache.get('a')).toBe(10);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('interceptorManager: handlers getter does not perform redundant lookups on large nextId', () => {
      const manager = new InterceptorManager();

      const id1 = manager.use(() => {});
      const _id2 = manager.use(() => {});
      manager.eject(id1);

      const handlers = manager.handlers;
      expect(handlers.length).toBe(2);
      expect(handlers[0]).toBeNull();
      expect(handlers[1]).toBeDefined();
    });
  });
});
