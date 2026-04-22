import {
  ERR_CANCELED,
  ERR_NETWORK,
  ETIMEDOUT,
} from '../constants/errorCodes';
import type {
  AccessioRequestConfig,
  AccessioResponse,
  AccessioError,
  RetryConditionFunction,
  OnRetryFunction,
} from '../types';

function defaultRetryCondition(error: any): boolean {
  if (error.code === ERR_CANCELED) {
    return false;
  }

  if (error.code === ERR_NETWORK) {
    return true;
  }

  if (error.code === ETIMEDOUT) {
    return true;
  }

  if (error.response && error.response.status >= 500) {
    return true;
  }

  return false;
}

function calculateDelay(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
}

function sleep(ms: number, options?: { signal?: AbortSignal }): Promise<void> {
  return new Promise((resolve, reject) => {
    let onAbort: (() => void) | undefined;

    const timeoutId = setTimeout(() => {
      if (options?.signal && onAbort) {
        options.signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        return reject(
          options.signal.reason || new Error('Sleep aborted'),
        );
      }

      onAbort = () => {
        clearTimeout(timeoutId);
        reject(options.signal!.reason || new Error('Sleep aborted'));
      };

      options.signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function retryRequest(
  dispatchFn: (config: AccessioRequestConfig) => Promise<any>,
  config: AccessioRequestConfig,
): Promise<any> {
  const maxRetries = config.retry ?? 0;

  if (maxRetries <= 0) {
    return dispatchFn(config);
  }

  const retryDelay = config.retryDelay ?? 1000;
  const retryCondition: RetryConditionFunction =
    config.retryCondition ?? defaultRetryCondition;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await dispatchFn(config);
      return response;
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt >= maxRetries;
      const shouldRetry = !isLastAttempt && retryCondition(error as AccessioError);

      if (!shouldRetry) {
        throw error;
      }

      const delay = calculateDelay(attempt, retryDelay);

      if (typeof config.onRetry === 'function') {
        (config.onRetry as OnRetryFunction)(
          attempt + 1,
          error as AccessioError,
          config,
        );
      }

      await sleep(delay, { signal: config.signal });
    }
  }

  throw lastError;
}

export { defaultRetryCondition, calculateDelay };
export default retryRequest;
