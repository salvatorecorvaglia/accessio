import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the real dispatchRequest, so we don't mock it.
// Instead we mock `fetch` globally.

describe('dispatchRequest (request.js)', () => {
  let dispatchRequest;

  beforeEach(async () => {
    // Dynamically import to get a fresh module each time
    vi.resetModules();
    const mod = await import('../src/core/request.js');
    dispatchRequest = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(data, options = {}) {
    const {
      status = 200,
      statusText = 'OK',
      headers = new Headers({ 'content-type': 'application/json' })
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
      })
    );
  }

  describe('basic requests', () => {
    it('makes a GET request', async () => {
      mockFetch({ users: [] });

      const response = await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'get',
        headers: {},
        transformResponse: [(data) => {
          if (typeof data === 'string') {
            try { return JSON.parse(data); } catch { /* ignore */ }
          }
          return data;
        }],
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ users: [] });
      expect(response.duration).toBeTypeOf('number');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('makes a POST request with JSON body', async () => {
      mockFetch({ id: 1 }, { status: 201, statusText: 'Created' });

      const response = await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'post',
        data: { name: 'John' },
        headers: { 'Content-Type': 'application/json' },
        transformRequest: [(data) => JSON.stringify(data)],
        transformResponse: [(data) => {
          if (typeof data === 'string') {
            try { return JSON.parse(data); } catch { /* ignore */ }
          }
          return data;
        }],
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(response.status).toBe(201);
      expect(response.data).toEqual({ id: 1 });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"John"}'
        })
      );
    });
  });

  describe('URL construction', () => {
    it('combines baseURL and url', async () => {
      mockFetch({});
      await dispatchRequest({
        url: '/users',
        baseURL: 'https://api.test.com',
        method: 'get',
        headers: {},
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.any(Object)
      );
    });

    it('appends query params', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/users',
        method: 'get',
        params: { page: 1, limit: 10 },
        headers: {},
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/users?page=1&limit=10',
        expect.any(Object)
      );
    });
  });

  describe('headers', () => {
    it('flattens common, method-specific, and custom headers', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {
          common: { 'Accept': 'application/json' },
          get: { 'X-Get-Only': 'true' },
          post: { 'X-Post-Only': 'true' },
          'X-Custom': 'value'
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const callHeaders = global.fetch.mock.calls[0][1].headers;
      expect(callHeaders['Accept']).toBe('application/json');
      expect(callHeaders['X-Get-Only']).toBe('true');
      expect(callHeaders['X-Custom']).toBe('value');
      // post-specific header should NOT be included
      expect(callHeaders['X-Post-Only']).toBeUndefined();
    });

    it('removes Content-Type when data is null', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'post',
        data: null,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const callHeaders = global.fetch.mock.calls[0][1].headers;
      expect(callHeaders['Content-Type']).toBeUndefined();
    });
  });

  describe('Basic Auth', () => {
    it('adds Authorization header for auth config', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        auth: { username: 'user', password: 'pass' },
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const callHeaders = global.fetch.mock.calls[0][1].headers;
      const expected = `Basic ${btoa('user:pass')}`;
      expect(callHeaders['Authorization']).toBe(expected);
    });
  });

  describe('credentials', () => {
    it('sets credentials to "include" when withCredentials is true', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        withCredentials: true,
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  describe('response types', () => {
    it('returns parsed JSON for responseType "json"', async () => {
      mockFetch({ hello: 'world' });
      const res = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        responseType: 'json',
        transformResponse: [(data) => {
          if (typeof data === 'string') {
            try { return JSON.parse(data); } catch { /* ignore */ }
          }
          return data;
        }],
        validateStatus: (s) => s >= 200 && s < 300,
      });
      expect(res.data).toEqual({ hello: 'world' });
    });

    it('returns raw text for responseType "text"', async () => {
      mockFetch('plain text response');
      const res = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 300,
      });
      expect(res.data).toBe('plain text response');
    });
  });

  describe('error handling', () => {
    it('rejects with AccessioError on 4xx status', async () => {
      mockFetch({ error: 'not found' }, { status: 404, statusText: 'Not Found' });

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/missing',
          method: 'get',
          headers: {},
          responseType: 'json',
          transformResponse: [(data) => {
            if (typeof data === 'string') {
              try { return JSON.parse(data); } catch { /* ignore */ }
            }
            return data;
          }],
          validateStatus: (s) => s >= 200 && s < 300,
        })
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_REQUEST',
      });
    });

    it('rejects with AccessioError on 5xx status', async () => {
      mockFetch('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/error',
          method: 'get',
          headers: {},
          responseType: 'json',
          transformResponse: [(data) => {
            if (typeof data === 'string') {
              try { return JSON.parse(data); } catch { /* ignore */ }
            }
            return data;
          }],
          validateStatus: (s) => s >= 200 && s < 300,
        })
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_BAD_RESPONSE',
      });
    });

    it('rejects with ERR_NETWORK on fetch failure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/down',
          method: 'get',
          headers: {},
          validateStatus: (s) => s >= 200 && s < 300,
        })
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_NETWORK',
      });
    });

    it('rejects with ERR_CANCELED on user abort', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      global.fetch = vi.fn(() => Promise.reject(abortError));

      await expect(
        dispatchRequest({
          url: 'https://api.test.com/slow',
          method: 'get',
          headers: {},
        })
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: 'ERR_CANCELED',
      });
    });
  });

  describe('timeout', () => {
    it('passes signal when timeout is set', async () => {
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        timeout: 5000,
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const fetchCall = global.fetch.mock.calls[0][1];
      expect(fetchCall.signal).toBeDefined();
    });

    it('passes user signal when no timeout', async () => {
      const controller = new AbortController();
      mockFetch({});
      await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        signal: controller.signal,
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const fetchCall = global.fetch.mock.calls[0][1];
      expect(fetchCall.signal).toBe(controller.signal);
    });
  });

  describe('response object structure', () => {
    it('includes all expected properties', async () => {
      mockFetch({ result: true });
      const res = await dispatchRequest({
        url: 'https://api.test.com/test',
        method: 'get',
        headers: {},
        responseType: 'json',
        transformResponse: [(data) => {
          if (typeof data === 'string') {
            try { return JSON.parse(data); } catch { /* ignore */ }
          }
          return data;
        }],
        validateStatus: (s) => s >= 200 && s < 300,
      });

      expect(res).toHaveProperty('data');
      expect(res).toHaveProperty('status');
      expect(res).toHaveProperty('statusText');
      expect(res).toHaveProperty('headers');
      expect(res).toHaveProperty('config');
      expect(res).toHaveProperty('request');
      expect(res).toHaveProperty('duration');
    });
  });
});
