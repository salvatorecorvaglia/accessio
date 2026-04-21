/**
 * Retry logic for Accessio HTTP client.
 *
 * Provides automatic retry with exponential backoff for failed requests.
 * Retries on network errors and 5xx responses by default.
 */

import { ERR_CANCELED, ERR_NETWORK, ETIMEDOUT } from '../constants/errorCodes.js';

/**
 * Default retry condition — retries on network errors and 5xx server errors.
 *
 * @param {import('./accessioError.js').default} error
 * @returns {boolean}
 */
function defaultRetryCondition(error) {
  // Don't retry on cancelled requests
  if (error.code === ERR_CANCELED) {
    return false;
  }

  // Retry on network errors
  if (error.code === ERR_NETWORK) {
    return true;
  }

  // Retry on timeout
  if (error.code === ETIMEDOUT) {
    return true;
  }

  // Retry on 5xx server errors
  if (error.response && error.response.status >= 500) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for a given retry attempt using exponential backoff with jitter.
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, baseDelay) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

/**
 * Wait for a specified number of milliseconds, with optional abort signal support.
 *
 * @param {number} ms - Milliseconds to wait
 * @param {object} [options] - Options
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel the sleep
 * @returns {Promise<void>}
 * @throws {Error} If the sleep is aborted
 */
function sleep(ms, options = {}) {
  return new Promise((resolve, reject) => {
    let onAbort;

    const timeoutId = setTimeout(() => {
      if (options.signal && onAbort) {
        options.signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        return reject(options.signal.reason || new Error('Sleep aborted'));
      }

      onAbort = () => {
        clearTimeout(timeoutId);
        reject(options.signal.reason || new Error('Sleep aborted'));
      };

      options.signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Wrap a dispatch function with retry logic.
 *
 * @param {Function} dispatchFn - The original dispatch function
 * @param {object} config - Request configuration
 * @returns {Promise<object>} Response object
 */
export default async function retryRequest(dispatchFn, config) {
  const maxRetries = config.retry || 0;

  // If no retries configured, just dispatch normally
  if (maxRetries <= 0) {
    return dispatchFn(config);
  }

  const retryDelay = config.retryDelay || 1000;
  const retryCondition = config.retryCondition || defaultRetryCondition;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await dispatchFn(config);
      return response;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries;
      const shouldRetry = !isLastAttempt && retryCondition(error);

      if (!shouldRetry) {
        throw error;
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, retryDelay);

      // Call onRetry callback if provided
      if (typeof config.onRetry === 'function') {
        config.onRetry(attempt + 1, error, config);
      }

      // Support abort signal for cancellation during retry wait
      await sleep(delay, { signal: config.signal });
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

export { defaultRetryCondition, calculateDelay };
