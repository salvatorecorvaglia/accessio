import { describe, it, expect, vi } from 'vitest';
import retryRequest, { defaultRetryCondition, calculateDelay } from '../src/core/retry';
import AccessioError from '../src/core/accessioError';

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

    it('retries on ETIMEDOUT', () => {
      const error = new AccessioError('timeout', AccessioError.ETIMEDOUT, null, null, null);
      expect(defaultRetryCondition(error)).toBe(true);
    });

    it('retries on 5xx server errors', () => {
      const error = new AccessioError('server error', AccessioError.ERR_BAD_RESPONSE, null, null, null);
      error.response = { status: 503, data: null, headers: {}, config: {}, request: {}, duration: 0, statusText: '' };
      expect(defaultRetryCondition(error)).toBe(true);
    });

    it('does not retry on 4xx client errors', () => {
      const error = new AccessioError('client error', AccessioError.ERR_BAD_REQUEST, null, null, null);
      error.response = { status: 404, data: null, headers: {}, config: {}, request: {}, duration: 0, statusText: '' };
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
          return Promise.reject(new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null));
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
        Promise.reject(new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null))
      );

      const config = { retry: 2, retryDelay: 1 };

      await expect(retryRequest(dispatch, config)).rejects.toMatchObject({
        code: 'ERR_NETWORK'
      });
      expect(dispatch).toHaveBeenCalledTimes(3);
    });

    it('does not retry when retryCondition returns false', async () => {
      const dispatch = vi.fn(() =>
        Promise.reject(new AccessioError('bad request', AccessioError.ERR_BAD_REQUEST, null, null, null))
      );

      const config = {
        retry: 3,
        retryDelay: 1,
        retryCondition: () => false
      };

      await expect(retryRequest(dispatch, config)).rejects.toMatchObject({
        code: 'ERR_BAD_REQUEST'
      });
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback before each retry', async () => {
      let attempt = 0;
      const dispatch = vi.fn(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(new AccessioError('net', AccessioError.ERR_NETWORK, null, null, null));
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
        error.response = { status: 429, data: null, headers: {}, config: {}, request: {}, duration: 0, statusText: '' };
        if (attempt < 2) return Promise.reject(error);
        return Promise.resolve({ status: 200 });
      });

      const config = {
        retry: 3,
        retryDelay: 1,
        retryCondition: (error: any) => error.response?.status === 429
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
          return Promise.reject(new AccessioError('network', AccessioError.ERR_NETWORK, null, null, null));
        }
        return Promise.resolve({ status: 200 });
      });

      const config = {
        retry: 3,
        retryDelay: 10000,
        signal: controller.signal
      };

      const retryPromise = retryRequest(dispatch, config);

      setTimeout(() => controller.abort(new Error('Test abort')), 10);

      await expect(retryPromise).rejects.toThrow('Test abort');
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });
});
