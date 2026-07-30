import { describe, expect, it, vi } from 'vitest';
import AccessioError from '../src/core/accessioError';
import retryRequest, { calculateDelay, defaultRetryCondition } from '../src/core/retry';

describe('retry.ts', () => {
  describe('defaultRetryCondition', () => {
    it('does not retry on ERR_CANCELED', () => {
      const error = new AccessioError('cancelled', AccessioError.ERR_CANCELED, null, null, null);
      expect(defaultRetryCondition(error)).toBe(false);
    });

    it('retries on ERR_NETWORK', () => {
      const error = new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null);
      expect(defaultRetryCondition(error)).toBe(true);
    });

    it('does not retry on ETIMEDOUT', () => {
      const error = new AccessioError('timeout', AccessioError.ETIMEDOUT, null, null, null);
      expect(defaultRetryCondition(error)).toBe(false);
    });

    it('retries on 5xx server errors', () => {
      const error = new AccessioError(
        'server error',
        AccessioError.ERR_BAD_RESPONSE,
        null,
        null,
        null,
      );
      Object.defineProperty(error, 'response', {
        value: {
          status: 503,
          data: null,
          headers: {},
          config: {},
          request: {},
          duration: 0,
          statusText: '',
        },
      });
      expect(defaultRetryCondition(error)).toBe(true);
    });

    it('does not retry on 4xx client errors', () => {
      const error = new AccessioError(
        'client error',
        AccessioError.ERR_BAD_REQUEST,
        null,
        null,
        null,
      );
      Object.defineProperty(error, 'response', {
        value: {
          status: 404,
          data: null,
          headers: {},
          config: {},
          request: {},
          duration: 0,
          statusText: '',
        },
      });
      expect(defaultRetryCondition(error)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('returns a number', () => {
      const delay = calculateDelay(0, 1000);
      expect(typeof delay).toBe('number');
    });

    it('increases with attempt number', () => {
      const delays = Array.from({ length: 100 }, () => calculateDelay(2, 1000));
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avg).toBeGreaterThan(2000);
    });
  });

  describe('retryRequest', () => {
    it('calls dispatch once when retry is 0', async () => {
      const dispatch = vi.fn(() => Promise.resolve({ status: 200 }));
      const config = { retry: 0 };

      await retryRequest(dispatch, config);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('does not retry when retry is not set', async () => {
      const dispatch = vi.fn(() => Promise.resolve({ status: 200 }));
      const config = {};

      await retryRequest(dispatch, config);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      let attempt = 0;
      const dispatch = vi.fn(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(
            new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null),
          );
        }
        return Promise.resolve({ status: 200 });
      });

      const config = { retry: 3, retryDelay: 1 };

      const result = await retryRequest(dispatch, config);
      expect(result.status).toBe(200);
      expect(dispatch).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting retries', async () => {
      const dispatch = vi.fn(() =>
        Promise.reject(new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null)),
      );

      const config = { retry: 2, retryDelay: 1 };

      await expect(retryRequest(dispatch, config)).rejects.toMatchObject({
        code: 'ERR_NETWORK',
      });
      expect(dispatch).toHaveBeenCalledTimes(3);
    });

    it('does not retry when retryCondition returns false', async () => {
      const dispatch = vi.fn(() =>
        Promise.reject(
          new AccessioError('bad request', AccessioError.ERR_BAD_REQUEST, null, null, null),
        ),
      );

      const config = {
        retry: 3,
        retryDelay: 1,
        retryCondition: () => false,
      };

      await expect(retryRequest(dispatch, config)).rejects.toMatchObject({
        code: 'ERR_BAD_REQUEST',
      });
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback before each retry', async () => {
      let attempt = 0;
      const dispatch = vi.fn(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(
            new AccessioError('net', AccessioError.ERR_NETWORK, null, null, null),
          );
        }
        return Promise.resolve({ status: 200 });
      });

      const onRetry = vi.fn();
      const config = { retry: 3, retryDelay: 1, onRetry };

      await retryRequest(dispatch, config);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(AccessioError), config);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(AccessioError), config);
    });

    it('uses custom retryCondition', async () => {
      let attempt = 0;
      const dispatch = vi.fn(() => {
        attempt++;
        const error = new AccessioError('error', AccessioError.ERR_BAD_REQUEST, null, null, null);
        Object.defineProperty(error, 'response', {
          value: {
            status: 429,
            data: null,
            headers: {},
            config: {},
            request: {},
            duration: 0,
            statusText: '',
          },
        });
        if (attempt < 2) return Promise.reject(error);
        return Promise.resolve({ status: 200 });
      });

      const config = {
        retry: 3,
        retryDelay: 1,
        retryCondition: (error: any) => error.response?.status === 429,
      };

      const result = await retryRequest(dispatch, config);
      expect(result.status).toBe(200);
      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('aborts retry wait when signal is aborted', async () => {
      const controller = new AbortController();
      let attempt = 0;
      const dispatch = vi.fn(() => {
        attempt++;
        if (attempt < 2) {
          return Promise.reject(
            new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null),
          );
        }
        return Promise.resolve({ status: 200 });
      });

      const config = {
        retry: 3,
        retryDelay: 10000,
        signal: controller.signal,
      };

      const retryPromise = retryRequest(dispatch, config);

      setTimeout(() => controller.abort(new Error('Test abort')), 10);

      await expect(retryPromise).rejects.toThrow('Test abort');
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryOn429', () => {
    function make429(headers: Record<string, string> = {}) {
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
          headers,
          data: null,
          config: {},
          request: {},
          duration: 0,
          statusText: 'Too Many Requests',
        },
      });
      return err;
    }

    it('retries a 429 when retryOn429 is true', async () => {
      const dispatch = vi
        .fn()
        .mockRejectedValueOnce(make429({ 'retry-after': '0' }))
        .mockResolvedValueOnce({ status: 200, data: 'ok' });

      const res = await retryRequest(dispatch, { retryOn429: true, retryDelay: 1 });
      expect(res).toEqual({ status: 200, data: 'ok' });
      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('does not retry a 429 when retryOn429 is false', async () => {
      const err = new AccessioError(
        'rate limited',
        AccessioError.ERR_BAD_REQUEST,
        { retryOn429: false } as any,
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
          statusText: '',
        },
      });
      const dispatch = vi.fn().mockRejectedValue(err);
      await expect(retryRequest(dispatch, { retry: 2, retryDelay: 1 })).rejects.toMatchObject({
        code: AccessioError.ERR_BAD_REQUEST,
      });
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('honors numeric Retry-After (seconds)', async () => {
      const dispatch = vi
        .fn()
        .mockRejectedValueOnce(make429({ 'retry-after': '1' }))
        .mockResolvedValueOnce({ status: 200 });

      const start = Date.now();
      await retryRequest(dispatch, { retryOn429: true, retryDelay: 1 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(900);
    }, 5000);

    it('honors HTTP-date Retry-After', async () => {
      // HTTP-date is second-precision; pad with 2s so the rounded value stays in the future.
      const future = new Date(Date.now() + 2000).toUTCString();
      const dispatch = vi
        .fn()
        .mockRejectedValueOnce(make429({ 'retry-after': future }))
        .mockResolvedValueOnce({ status: 200 });

      const start = Date.now();
      await retryRequest(dispatch, { retryOn429: true, retryDelay: 1 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500);
    }, 5000);
  });

  describe('unretriable bodies', () => {
    it('refuses to retry when data is a ReadableStream and surfaces ERR_BAD_OPTION', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('payload'));
          controller.close();
        },
      });

      const networkError = new AccessioError(
        'network down',
        AccessioError.ERR_NETWORK,
        null,
        null,
        null,
      );
      const dispatch = vi.fn().mockRejectedValue(networkError);

      await expect(
        retryRequest(dispatch, {
          url: '/x',
          method: 'POST',
          data: stream,
          retry: 3,
          retryDelay: 1,
        }),
      ).rejects.toMatchObject({
        isAccessioError: true,
        code: AccessioError.ERR_BAD_OPTION,
        message: expect.stringContaining('ReadableStream'),
      });

      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('still retries when body is a plain object', async () => {
      const networkError = new AccessioError(
        'network down',
        AccessioError.ERR_NETWORK,
        null,
        null,
        null,
      );
      const dispatch = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ status: 200, data: 'ok' });

      const result = await retryRequest(dispatch, {
        url: '/x',
        method: 'POST',
        data: { hello: 'world' },
        retry: 2,
        retryDelay: 1,
      });

      expect(result).toEqual({ status: 200, data: 'ok' });
      expect(dispatch).toHaveBeenCalledTimes(2);
    });
  });
});
