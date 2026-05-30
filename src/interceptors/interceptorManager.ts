import type { TransformFunction, InterceptorHandler, InterceptorOptions } from '../types';

export class InterceptorManager {
  private _handlers: Map<number, InterceptorHandler>;
  private _nextId: number;

  constructor() {
    this._handlers = new Map();
    this._nextId = 0;
  }

  use(
    fulfilled: TransformFunction | null,
    rejected?: ((error: unknown) => unknown) | null,
    options: InterceptorOptions = {},
  ): number {
    const id = this._nextId++;
    this._handlers.set(id, {
      fulfilled: fulfilled || null,
      rejected: rejected || null,
      synchronous: options.synchronous || false,
      runWhen: options.runWhen || null,
    });
    return id;
  }

  eject(id: number): void {
    this._handlers.delete(id);
  }

  clear(): void {
    this._handlers.clear();
  }

  forEach(fn: (handler: InterceptorHandler) => void): void {
    for (const handler of this._handlers.values()) {
      fn(handler);
    }
  }

  get size(): number {
    return this._handlers.size;
  }

  /**
   * Snapshot view for backward-compat introspection. Slot index = interceptor ID;
   * ejected IDs appear as `null`. Reading this builds a fresh array each time —
   * prefer `forEach`/`size` in hot paths.
   */
  get handlers(): Array<InterceptorHandler | null> {
    const max = this._nextId;
    const out: Array<InterceptorHandler | null> = [];
    for (let i = 0; i < max; i++) {
      out.push(this._handlers.get(i) ?? null);
    }
    return out;
  }
}

export default InterceptorManager;
