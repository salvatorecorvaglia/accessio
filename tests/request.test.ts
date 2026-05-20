import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('dispatchRequest (request.ts)', () => {
  let dispatchRequest: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    const mod = await import('../src/core/request');
    dispatchRequest = mod.default;
  });

  function mockFetch(data: any, options: any = {}) {
    const {
      status = 200,
      statusText = 'OK',
      headers = new Headers({ 'content-type': 'application/json' }),
    } = options;

    const body = typeof data === 'string' ? data : JSON.stringify(data);

    global.fetch = vi.fn(() =>
      Promise.resolve({
        status,
        statusText,
        headers,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(typeof data === 'object' ? data : JSON.parse(data)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        blob: () => Promise.resolve(new Blob([body])),
        body: null,
      }),
    ) as any;
  }

  describe('basic requests', () => {
    it('makes a GET request', async () => {
      mockFetch({ users: [] });

      const response = await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'get',
        headers: {},
        transformResponse: [
          (data: any) => (typeof data === 'string' ? JSON.parse(data as string) : data),
        ],
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ users: [] });
    });

    it('makes a POST request with data', async () => {
      mockFetch({ id: 1 });
      const postData = { name: 'John' };

      const response = await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'post',
        headers: {},
        data: postData,
      });

      expect(response.status).toBe(200);
    });

    it('includes duration in response', async () => {
      mockFetch({ ok: true });

      const response = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
      });

      expect(response.duration).toBeDefined();
      expect(typeof response.duration).toBe('number');
    });

    it('applies transformResponse for JSON by default', async () => {
      mockFetch({ users: [] });

      const response = await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'get',
        headers: {},
        transformResponse: [
          (data: any) => (typeof data === 'string' ? JSON.parse(data as string) : data),
        ],
      });

      expect(response.data).toEqual({ users: [] });
    });
  });

  describe('headers', () => {
    it('merges common headers', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {
          common: { Accept: 'text/html' },
          get: {},
        },
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const fetchOptions = fetchCall[1] as RequestInit;
      expect((fetchOptions.headers as Headers).get('accept')).toBe('text/html');
    });

    it('removes Content-Type for FormData', async () => {
      mockFetch({});
      const formData = new FormData();

      await dispatchRequest({
        url: 'https://api.test.com/upload',
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        data: formData,
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const fetchOptions = fetchCall[1] as RequestInit;
      expect((fetchOptions.headers as Headers).has('content-type')).toBe(false);
    });
  });

  describe('authentication', () => {
    it('adds Basic auth header', async () => {
      mockFetch({});

      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        auth: { username: 'user', password: 'pass' },
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const fetchOptions = fetchCall[1] as RequestInit;
      expect((fetchOptions.headers as Headers).get('authorization')).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('responseType', () => {
    it('parses JSON by default', async () => {
      mockFetch({ message: 'hello' });

      const response = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        transformResponse: [
          (data: any) => (typeof data === 'string' ? JSON.parse(data as string) : data),
        ],
      });

      expect(response.data).toEqual({ message: 'hello' });
    });

    it('returns text when responseType is text', async () => {
      mockFetch('plain text', { headers: new Headers({ 'content-type': 'text/plain' }) });

      const response = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        responseType: 'text',
      });

      expect(response.data).toBe('plain text');
    });
  });

  describe('error handling', () => {
    it('rejects on 4xx status', async () => {
      mockFetch({ error: 'Not Found' }, { status: 404 });

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/test',
          method: 'get',
          headers: {},
          validateStatus: (status: number) => status >= 200 && status < 300,
        }),
      ).rejects.toThrow('Request failed with status code 404');
    });

    it('resolves on 2xx when validateStatus returns true', async () => {
      mockFetch({ ok: true }, { status: 201 });

      const response = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'post',
        headers: {},
        validateStatus: () => true,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('timeout', () => {
    it('creates AbortController for timeout', async () => {
      mockFetch({});

      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        timeout: 5000,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe('abort classification (M1)', () => {
    it('classifies user-abort with non-AbortError reason as ERR_CANCELED', async () => {
      global.fetch = vi.fn((_url, init: any) => {
        return new Promise((_resolve, reject) => {
          const fail = () => {
            const err = new Error('user cancelled');
            err.name = 'CustomCancel';
            reject(err);
          };
          if (init.signal?.aborted) {
            queueMicrotask(fail);
            return;
          }
          init.signal?.addEventListener('abort', fail, { once: true });
        });
      }) as any;

      const controller = new AbortController();
      const p = dispatchRequest({
        url: 'https://api.test.com/slow',
        method: 'get',
        headers: {},
        signal: controller.signal,
        timeout: 10_000,
      });
      controller.abort(new Error('user cancelled'));
      await expect(p).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_CANCELED',
      });
    });

    it('still classifies timeout as ETIMEDOUT', async () => {
      global.fetch = vi.fn((_url, init: any) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }) as any;

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/slow',
          method: 'get',
          headers: {},
          timeout: 5,
        }),
      ).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    });
  });

  describe('invalid URL classification (M3)', () => {
    it('throws ERR_INVALID_URL up front for malformed URLs', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({ url: 'http://exa mple.com/x', method: 'get', headers: {} }),
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_INVALID_URL',
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('TypeError "fetch failed" from network layer is ERR_NETWORK, not ERR_INVALID_URL', async () => {
      global.fetch = vi.fn(() => Promise.reject(new TypeError('fetch failed'))) as any;
      await expect(
        dispatchRequest({ url: 'https://api.test.com/x', method: 'get', headers: {} }),
      ).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    });
  });

  describe('protocol allow-list', () => {
    it('rejects file: URLs by default', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({ url: 'file:///etc/passwd', method: 'get', headers: {} }),
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_OPTION',
        message: expect.stringContaining('file:'),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects javascript: URLs by default', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({ url: 'javascript:alert(1)', method: 'get', headers: {} }),
      ).rejects.toMatchObject({ code: 'ERR_BAD_OPTION' });
    });

    it('allows http and https by default', async () => {
      mockFetch({ ok: true });
      const res = await dispatchRequest({
        url: 'http://api.test.com/x',
        method: 'get',
        headers: {},
        transformResponse: [(d: any) => (typeof d === 'string' ? JSON.parse(d) : d)],
      });
      expect(res.status).toBe(200);
    });

    it('allows opting into additional protocols', async () => {
      mockFetch({ ok: true });
      const res = await dispatchRequest({
        url: 'ws://api.test.com/x',
        method: 'get',
        headers: {},
        allowedProtocols: ['http:', 'https:', 'ws:'],
        transformResponse: [(d: any) => (typeof d === 'string' ? JSON.parse(d) : d)],
      });
      expect(res.status).toBe(200);
    });

    it('disables the check when allowedProtocols is null', async () => {
      mockFetch({ ok: true });
      const res = await dispatchRequest({
        url: 'file:///tmp/x',
        method: 'get',
        headers: {},
        allowedProtocols: null,
        transformResponse: [(d: any) => (typeof d === 'string' ? JSON.parse(d) : d)],
      });
      expect(res.status).toBe(200);
    });

    it('allows scheme-less (relative) URLs', async () => {
      mockFetch({ ok: true });
      const res = await dispatchRequest({
        url: '/api/x',
        method: 'get',
        headers: {},
        transformResponse: [(d: any) => (typeof d === 'string' ? JSON.parse(d) : d)],
      });
      expect(res.status).toBe(200);
    });

    it('rejects header values containing CRLF', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({
          url: 'https://api.test.com/x',
          method: 'get',
          headers: { 'X-Custom': 'foo\r\nInjected: yes' },
        }),
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_OPTION',
        message: expect.stringContaining('CR, LF and NUL'),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects header names containing CRLF or NUL', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({
          url: 'https://api.test.com/x',
          method: 'get',
          headers: { 'X-Bad\nName': 'safe' },
        }),
      ).rejects.toMatchObject({ code: 'ERR_BAD_OPTION' });
    });

    it('scrubs auth from response.config', async () => {
      mockFetch({ ok: true });
      const res = await dispatchRequest({
        url: 'https://api.test.com/x',
        method: 'get',
        headers: { Authorization: 'Bearer s3cret' },
        auth: { username: 'u', password: 'p' },
        transformResponse: [(d: any) => (typeof d === 'string' ? JSON.parse(d) : d)],
      });
      expect((res.config as any).auth).toBeUndefined();
      expect((res.config.headers as any).Authorization).toBe('[REDACTED]');
    });

    it('preserves raw body in error when JSON parse fails', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          text: () => Promise.resolve('not-json-{'),
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          blob: () => Promise.resolve(new Blob()),
          body: null,
        } as any),
      ) as any;

      await expect(
        dispatchRequest({ url: 'https://api.test.com/bad', method: 'get', headers: {} }),
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_RESPONSE',
        message: expect.stringContaining('not-json-{'),
      });
    });

    it('dedupes concurrent GETs and clears the entry on settle', async () => {
      let fetchCalls = 0;
      global.fetch = vi.fn(() => {
        fetchCalls++;
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{"ok":true}'),
                json: () => Promise.resolve({ ok: true }),
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                blob: () => Promise.resolve(new Blob()),
                body: null,
              } as any),
            5,
          ),
        );
      }) as any;

      const base = {
        url: 'https://api.test.com/same',
        method: 'get',
        headers: {},
        dedupe: true,
      } as any;
      const [a, b] = await Promise.all([dispatchRequest(base), dispatchRequest(base)]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(fetchCalls).toBe(1);

      // Subsequent identical request after settle must trigger a fresh fetch (entry cleaned up).
      await dispatchRequest(base);
      expect(fetchCalls).toBe(2);
    });

    it('does not share dedupe slot across different Authorization headers (H1)', async () => {
      let fetchCalls = 0;
      global.fetch = vi.fn(() => {
        fetchCalls++;
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: () => Promise.resolve('{"ok":true}'),
                json: () => Promise.resolve({ ok: true }),
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                blob: () => Promise.resolve(new Blob()),
                body: null,
              } as any),
            5,
          ),
        );
      }) as any;

      const base = {
        url: 'https://api.test.com/me',
        method: 'get',
        dedupe: true,
      } as any;
      await Promise.all([
        dispatchRequest({ ...base, headers: { Authorization: 'Bearer alice' } }),
        dispatchRequest({ ...base, headers: { Authorization: 'Bearer bob' } }),
      ]);
      expect(fetchCalls).toBe(2);
    });

    it('does not share cache entry across different Accept headers (H1)', async () => {
      const cache = new Map<string, any>();
      const provider = {
        get: (k: string) => cache.get(k),
        set: (k: string, v: any) => cache.set(k, v),
      };
      let fetchCalls = 0;
      global.fetch = vi.fn(() => {
        fetchCalls++;
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          text: () => Promise.resolve('{"ok":true}'),
          json: () => Promise.resolve({ ok: true }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          blob: () => Promise.resolve(new Blob()),
          body: null,
        } as any);
      }) as any;

      const base = {
        url: 'https://api.test.com/thing',
        method: 'get',
        cache: provider,
      } as any;
      await dispatchRequest({ ...base, headers: { Accept: 'application/json' } });
      await dispatchRequest({ ...base, headers: { Accept: 'application/xml' } });
      expect(fetchCalls).toBe(2);
    });

    it('gives each dedupe consumer an independent config view (H2)', async () => {
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 200,
                  statusText: 'OK',
                  headers: new Headers({ 'content-type': 'application/json' }),
                  text: () => Promise.resolve('{"ok":true}'),
                  json: () => Promise.resolve({ ok: true }),
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  body: null,
                } as any),
              5,
            ),
          ),
      ) as any;

      const baseUrl = 'https://api.test.com/shared';
      const a = dispatchRequest({
        url: baseUrl,
        method: 'get',
        dedupe: true,
        headers: { Authorization: 'Bearer X' },
        meta: { caller: 'A' },
      } as any);
      const b = dispatchRequest({
        url: baseUrl,
        method: 'get',
        dedupe: true,
        headers: { Authorization: 'Bearer X' },
        meta: { caller: 'B' },
      } as any);
      const [respA, respB] = await Promise.all([a, b]);

      expect(respA).not.toBe(respB);
      expect((respA.config as any).meta.caller).toBe('A');
      expect((respB.config as any).meta.caller).toBe('B');
      expect((respA.config as any).headers.Authorization).toBe('[REDACTED]');
    });

    it('clears dedupe entry on rejection', async () => {
      let fetchCalls = 0;
      global.fetch = vi.fn(() => {
        fetchCalls++;
        return Promise.reject(new TypeError('network down'));
      }) as any;

      const base = {
        url: 'https://api.test.com/fail',
        method: 'get',
        headers: {},
        dedupe: true,
      } as any;
      await expect(dispatchRequest(base)).rejects.toBeDefined();
      await expect(dispatchRequest(base)).rejects.toBeDefined();
      expect(fetchCalls).toBe(2);
    });

    it('caps the dedupe registry to prevent unbounded growth on hung requests (M9)', async () => {
      const { __activeRequestsSize } = await import('../src/core/request');
      // Use a fetch that never settles so cleanup-on-settle never fires.
      global.fetch = vi.fn(() => new Promise(() => {})) as any;

      const before = __activeRequestsSize();
      // 1500 > MAX_ACTIVE_REQUESTS (1024). Unique URLs ⇒ unique dedupe keys.
      for (let i = 0; i < 1500; i++) {
        // Fire-and-forget — the promises never settle.
        void dispatchRequest({
          url: `https://api.test.com/hang/${i}`,
          method: 'get',
          headers: {},
          dedupe: true,
        } as any).catch(() => {});
      }
      const after = __activeRequestsSize();
      expect(after - before).toBeLessThanOrEqual(1024);
    });

    it('catches a malicious baseURL scheme', async () => {
      mockFetch({});
      await expect(
        dispatchRequest({
          baseURL: 'file://etc',
          url: 'passwd',
          method: 'get',
          headers: {},
        }),
      ).rejects.toMatchObject({ code: 'ERR_BAD_OPTION' });
    });
  });
});
