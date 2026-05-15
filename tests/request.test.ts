import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
      const response = await dispatchRequest({
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
});
