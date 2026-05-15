import type { RateLimiter, AccessioRequestConfig, AccessioResponse } from '../types';

interface QueueItem {
  resolve: () => void;
  reject: (reason: Error) => void;
}

export function createRateLimiter(
  maxConcurrent: number = Infinity,
  maxQueueSize: number = Infinity,
): RateLimiter {
  if (maxConcurrent !== Infinity && (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)) {
    throw new RangeError(
      `[Accessio] maxConcurrent must be a positive integer or Infinity, got: ${maxConcurrent}`,
    );
  }
  if (maxQueueSize !== Infinity && (!Number.isInteger(maxQueueSize) || maxQueueSize < 1)) {
    throw new RangeError(
      `[Accessio] maxQueueSize must be a positive integer or Infinity, got: ${maxQueueSize}`,
    );
  }
  let active = 0;
  let destroyed = false;
  let head = 0;
  let tail = 0;
  let pendingCount = 0;
  const queue: Record<number, QueueItem> = {};

  function acquire(): Promise<void> {
    if (destroyed) {
      return Promise.reject(new Error('[Accessio] Rate limiter has been destroyed'));
    }

    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }

    if (pendingCount >= maxQueueSize) {
      return Promise.reject(
        new Error(`[Accessio] Rate limiter queue size exceeded maxQueueSize (${maxQueueSize})`),
      );
    }

    return new Promise((resolve, reject) => {
      queue[tail++] = { resolve, reject };
      pendingCount++;
    });
  }

  function release(): void {
    if (destroyed) return;

    if (active <= 0) return;

    active--;

    if (pendingCount > 0 && active < maxConcurrent) {
      active++;
      const next = queue[head];
      delete queue[head];
      head++;
      pendingCount--;
      next?.resolve();
    }
  }

  function destroy(): void {
    destroyed = true;
    const reason = new Error('[Accessio] Rate limiter destroyed — pending request cancelled');
    while (pendingCount > 0) {
      const next = queue[head];
      delete queue[head];
      head++;
      pendingCount--;
      next?.reject(reason);
    }
  }

  return {
    acquire,
    release,
    destroy,
    get pending() {
      return pendingCount;
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
  await limiter.acquire();
  try {
    return await dispatchFn(config);
  } finally {
    limiter.release();
  }
}

export default createRateLimiter;
