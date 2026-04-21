/**
 * Rate Limiter for Accessio HTTP client.
 *
 * Limits the number of concurrent in-flight requests.
 * Excess requests are queued and executed as slots become available.
 *
 * NOTE: This is a standalone utility helper — it is NOT automatically
 * integrated into Accessio's request pipeline. To use it, wrap your dispatch
 * calls manually:
 *
 * @example
 * ```js
 * import accessio, { createRateLimiter } from 'accessio';
 *
 * const limiter = createRateLimiter(5); // max 5 concurrent requests
 *
 * // Option 1: manual acquire/release
 * await limiter.acquire();
 * try {
 *   const res = await accessio.get('/api/data');
 * } finally {
 *   limiter.release();
 * }
 *
 * // Option 2: use the rateLimitedRequest wrapper
 * // rateLimitedRequest(dispatchFn, limiter, config)
 *
 * // Option 3: cleanup on page navigation / component unmount
 * limiter.destroy(); // Rejects all queued promises immediately
 * ```
 */

/**
 * Create a rate limiter that limits concurrent request execution.
 *
 * @param {number} maxConcurrent - Maximum number of concurrent requests (default: Infinity)
 * @returns {{ acquire: () => Promise<void>, release: () => void, destroy: () => void, pending: number, active: number }}
 */
export function createRateLimiter(maxConcurrent = Infinity) {
  // Input validation
  if (
    maxConcurrent !== Infinity &&
    (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
  ) {
    throw new RangeError(
      `[Accessio] maxConcurrent must be a positive integer or Infinity, got: ${maxConcurrent}`,
    );
  }
  let active = 0;
  let destroyed = false;
  const queue = [];

  /**
   * Acquire a slot. Resolves immediately if a slot is available,
   * otherwise queues and waits.
   * @returns {Promise<void>}
   */
  function acquire() {
    if (destroyed) {
      return Promise.reject(
        new Error("[Accessio] Rate limiter has been destroyed"),
      );
    }

    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      queue.push({ resolve, reject });
    });
  }

  /**
   * Release a slot. If there are queued requests, the next one is started.
   */
  function release() {
    // No operation after destroy
    if (destroyed) return;

    // Guard against inconsistent decrements (double release or spurious calls)
    if (active <= 0) return;

    active--;

    if (queue.length > 0 && active < maxConcurrent) {
      active++;
      const next = queue.shift();
      next.resolve();
    }
  }

  /**
   * Destroy the limiter — rejects all pending queued promises immediately.
   * Useful for cleanup on SPA navigation or component unmount.
   * After destroy(), any new `acquire()` calls will also reject.
   */
  function destroy() {
    destroyed = true;
    const reason = new Error(
      "[Accessio] Rate limiter destroyed — pending request cancelled",
    );
    while (queue.length > 0) {
      const next = queue.shift();
      next.reject(reason);
    }
  }

  return {
    acquire,
    release,
    destroy,
    /** Number of requests waiting in the queue */
    get pending() {
      return queue.length;
    },
    /** Number of currently active requests */
    get active() {
      return active;
    },
    /** Whether the limiter has been destroyed */
    get destroyed() {
      return destroyed;
    },
  };
}

/**
 * Wrap a dispatch function with rate limiting.
 *
 * @param {Function} dispatchFn - The original dispatch function
 * @param {object} limiter - Rate limiter instance from createRateLimiter()
 * @param {object} config - Request config
 * @returns {Promise<object>} Response
 */
export async function rateLimitedRequest(dispatchFn, limiter, config) {
  await limiter.acquire();
  try {
    return await dispatchFn(config);
  } finally {
    limiter.release();
  }
}

export default createRateLimiter;
