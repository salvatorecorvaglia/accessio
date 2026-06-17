import { ERR_BAD_OPTION, ERR_CANCELED, ERR_NETWORK } from '../constants/errorCodes';
import type {
  AccessioError,
  AccessioRequestConfig,
  OnRetryFunction,
  RetryConditionFunction,
} from '../types';
import AccessioErrorClass from './accessioError';

function isUnretriableBody(data: unknown): boolean {
  if (data == null) return false;
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) return true;
  if (data && typeof (data as any).pipe === 'function') return true;
  return false;
}

function defaultRetryCondition(error: any): boolean {
  if (error.code === ERR_CANCELED) {
    return false;
  }

  if (error.code === ERR_NETWORK) {
    return true;
  }

  if (error.response && error.response.status >= 500) {
    return true;
  }

  if (error.config?.retryOn429 && error.response && error.response.status === 429) {
    return true;
  }

  return false;
}

function calculateDelay(attempt: number, baseDelay: number, maxDelay = 30000): number {
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const calculated = Math.round(exponentialDelay + jitter);
  return Math.min(calculated, maxDelay);
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
        return reject(options.signal.reason || new Error('Sleep aborted'));
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

  if (maxRetries <= 0 && !config.retryOn429) {
    return dispatchFn(config);
  }

  const retryDelay = config.retryDelay ?? 1000;
  const retryCondition: RetryConditionFunction = config.retryCondition ?? defaultRetryCondition;

  let lastError: any;
  const actualMaxRetries = Math.max(maxRetries, config.retryOn429 ? 3 : 0);

  for (let attempt = 0; attempt <= actualMaxRetries; attempt++) {
    try {
      const response = await dispatchFn(config);
      return response;
    } catch (error) {
      lastError = error;

      const is429 = (error as any).response?.status === 429;
      const attemptLimit = is429 && config.retryOn429 ? Math.max(maxRetries, 3) : maxRetries;
      const shouldRetry = attempt < attemptLimit && retryCondition(error as AccessioError);

      if (!shouldRetry) {
        throw error;
      }

      if (isUnretriableBody(config.data)) {
        throw new AccessioErrorClass(
          'Request body is a ReadableStream and cannot be retried after consumption. ' +
            'Buffer the stream upstream or set retry: 0 for this call.',
          ERR_BAD_OPTION,
          config,
          null,
          (error as AccessioError).response ?? null,
        );
      }

      let delay = calculateDelay(attempt, retryDelay, config.maxRetryDelay ?? 30000);

      if (config.retryOn429 && (error as any).response?.status === 429) {
        const headers = (error as any).response?.headers;
        const retryAfterStr = headers?.['retry-after'] || headers?.['Retry-After'];
        if (retryAfterStr) {
          const parsed = Number.parseInt(retryAfterStr, 10);
          if (!Number.isNaN(parsed)) {
            delay = parsed * 1000;
          } else {
            const date = new Date(retryAfterStr);
            if (!Number.isNaN(date.getTime())) {
              delay = Math.max(0, date.getTime() - Date.now());
            }
          }
        }
      }

      if (typeof config.onRetry === 'function') {
        (config.onRetry as OnRetryFunction)(attempt + 1, error as AccessioError, config);
      }

      await sleep(delay, { signal: config.signal });
    }
  }

  throw lastError;
}

export { defaultRetryCondition, calculateDelay };
export default retryRequest;
