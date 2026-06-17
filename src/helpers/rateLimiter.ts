import type { AccessioRequestConfig, AccessioResponse, RateLimiter } from '../types';

interface QueueItem {
  resolve: () => void;
  reject: (reason: Error) => void;
}

export function createRateLimiter(
  maxConcurrent: number = Number.POSITIVE_INFINITY,
  maxQueueSize: number = Number.POSITIVE_INFINITY,
): RateLimiter {
  if (
    maxConcurrent !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
  ) {
    throw new RangeError(
      `[Accessio] maxConcurrent must be a positive integer or Infinity, got: ${maxConcurrent}`,
    );
  }
  if (
    maxQueueSize !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxQueueSize) || maxQueueSize < 1)
  ) {
    throw new RangeError(
      `[Accessio] maxQueueSize must be a positive integer or Infinity, got: ${maxQueueSize}`,
    );
  }
  let active = 0;
  let destroyed = false;
  const queue: QueueItem[] = [];

  function acquire(signal?: AbortSignal): Promise<void> {
    if (destroyed) {
      return Promise.reject(new Error('[Accessio] Rate limiter has been destroyed'));
    }

    if (signal?.aborted) {
      return Promise.reject(signal.reason || new Error('Request aborted'));
    }

    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }

    if (queue.length >= maxQueueSize) {
      return Promise.reject(
        new Error(`[Accessio] Rate limiter queue size exceeded maxQueueSize (${maxQueueSize})`),
      );
    }

    return new Promise((resolve, reject) => {
      let onAbort: (() => void) | undefined;

      const item = {
        resolve: () => {
          if (signal && onAbort) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve();
        },
        reject: (err: Error) => {
          if (signal && onAbort) {
            signal.removeEventListener('abort', onAbort);
          }
          reject(err);
        },
      };

      queue.push(item);

      if (signal) {
        onAbort = () => {
          const index = queue.indexOf(item);
          if (index !== -1) {
            queue.splice(index, 1);
          }
          reject(signal.reason || new Error('Request aborted'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  function release(): void {
    if (destroyed) return;
    if (active <= 0) return;

    const next = queue.shift();
    if (next) {
      next.resolve();
      return;
    }
    active--;
  }

  function destroy(): void {
    destroyed = true;
    const reason = new Error('[Accessio] Rate limiter destroyed — pending request cancelled');
    while (queue.length > 0) {
      queue.shift()!.reject(reason);
    }
  }

  return {
    acquire,
    release,
    destroy,
    get pending() {
      return queue.length;
    },
    get active() {
      return active;
    },
    get destroyed() {
      return destroyed;
    },
  };
}

export async function rateLimitedRequest<T = unknown>(
  dispatchFn: (config: AccessioRequestConfig) => Promise<AccessioResponse<T>>,
  limiter: RateLimiter,
  config: AccessioRequestConfig,
): Promise<AccessioResponse<T>> {
  await limiter.acquire(config.signal);
  try {
    return await dispatchFn(config);
  } finally {
    limiter.release();
  }
}

export default createRateLimiter;
