import type {
  RateLimiter,
  AccessioRequestConfig,
  AccessioResponse,
} from '../types';

interface QueueItem {
  resolve: () => void;
  reject: (reason: Error) => void;
}

export function createRateLimiter(maxConcurrent: number = Infinity): RateLimiter {
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
  const queue: QueueItem[] = [];

  function acquire(): Promise<void> {
    if (destroyed) {
      return Promise.reject(
        new Error('[Accessio] Rate limiter has been destroyed'),
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

  function release(): void {
    if (destroyed) return;

    if (active <= 0) return;

    active--;

    if (queue.length > 0 && active < maxConcurrent) {
      active++;
      const next = queue.shift();
      next?.resolve();
    }
  }

  function destroy(): void {
    destroyed = true;
    const reason = new Error(
      '[Accessio] Rate limiter destroyed — pending request cancelled',
    );
    while (queue.length > 0) {
      const next = queue.shift();
      next?.reject(reason);
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
  await limiter.acquire();
  try {
    return await dispatchFn(config);
  } finally {
    limiter.release();
  }
}

export default createRateLimiter;
