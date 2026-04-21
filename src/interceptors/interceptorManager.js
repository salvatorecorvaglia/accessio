/**
 * InterceptorManager — Manages request/response interceptors.
 *
 * Interceptors can transform or inspect the config (request interceptors)
 * or response (response interceptors) before they reach the application code.
 */
class InterceptorManager {
  constructor() {
    /**
     * @type {Array<{fulfilled: Function, rejected: Function, synchronous: boolean, runWhen: Function|null} | null>}
     */
    this.handlers = [];

    /** @private Active (non-ejected) interceptor count */
    this._activeCount = 0;
  }

  /**
   * Register a new interceptor.
   *
   * @param {Function} fulfilled - Called when the interceptor is fulfilled
   * @param {Function} [rejected] - Called when the interceptor is rejected
   * @param {object} [options] - Interceptor options
   * @param {boolean} [options.synchronous=false] - Reserved: if true the interceptor
   *   should run synchronously (microtask scheduling optimisation).
   *   **Not yet implemented** — the field is saved but ignored in the Promise chain.
   *   Planned feature for a future release.
   * @param {Function} [options.runWhen] - Predicate function; interceptor runs only when it returns true
   * @returns {number} Interceptor ID (used for eject)
   */
  use(fulfilled, rejected, options = {}) {
    this.handlers.push({
      fulfilled: fulfilled || null,
      rejected: rejected || null,
      synchronous: options.synchronous || false,
      runWhen: options.runWhen || null
    });

    this._activeCount++;
    return this.handlers.length - 1;
  }

  /**
   * Remove an interceptor by its ID.
   *
   * @param {number} id - The interceptor ID returned by `use()`
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
      this._activeCount--;
    }
  }

  /**
   * Remove all interceptors.
   */
  clear() {
    this.handlers = [];
    this._activeCount = 0;
  }

  /**
   * Iterate over all registered interceptors.
   * Skips interceptors that have been ejected (null entries).
   *
   * @param {Function} fn - Function called for each interceptor
   */
  forEach(fn) {
    for (const handler of this.handlers) {
      if (handler !== null) {
        fn(handler);
      }
    }
  }

  /**
   * Get the number of active (non-ejected) interceptors.
   * @returns {number}
   */
  get size() {
    return this._activeCount;
  }
}

export default InterceptorManager;
