import type { TransformFunction, InterceptorHandler, InterceptorOptions } from '../types';

export class InterceptorManager {
  handlers: Array<InterceptorHandler | null>;
  private _activeCount: number;

  constructor() {
    this.handlers = [];
    this._activeCount = 0;
  }

  use(
    fulfilled: TransformFunction | null,
    rejected?: ((error: unknown) => unknown) | null,
    options: InterceptorOptions = {},
  ): number {
    this.handlers.push({
      fulfilled: fulfilled || null,
      rejected: rejected || null,
      synchronous: options.synchronous || false,
      runWhen: options.runWhen || null,
    });

    this._activeCount++;
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
      this._activeCount--;
    }
  }

  clear(): void {
    this.handlers = [];
    this._activeCount = 0;
  }

  forEach(fn: (handler: InterceptorHandler) => void): void {
    for (const handler of this.handlers) {
      if (handler !== null) {
        fn(handler);
      }
    }
  }

  get size(): number {
    return this._activeCount;
  }
}

export default InterceptorManager;
