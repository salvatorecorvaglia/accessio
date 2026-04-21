/**
 * Accessio — Entry point.
 *
 * Creates and exports the default Accessio instance with all public API.
 * Supports both `import accessio from 'accessio'` and `const { create } = require('accessio')`.
 *
 * @module accessio
 * @example
 * ```js
 * import accessio, { createRateLimiter, buildURL, mergeConfig } from 'accessio';
 *
 * // Quick GET request
 * const response = await accessio.get('https://api.example.com/users');
 * console.log(response.data);
 *
 * // Create a custom instance
 * const api = accessio.create({ baseURL: 'https://api.example.com' });
 *
 * // Use utilities directly
 * const url = buildURL('/users', 'https://api.example.com', { page: 1 });
 * ```
 */

import Accessio from "./accessio.js";
import defaults from "./defaults/index.js";
import AccessioError from "./core/accessioError.js";
import mergeConfig from "./core/mergeConfig.js";
import buildURL from "./core/buildURL.js";
import InterceptorManager from "./interceptors/interceptorManager.js";
import { createRateLimiter } from "./helpers/rateLimiter.js";
import { logRequest, logResponse, logError } from "./helpers/debug.js";
import { ERR_CANCELED } from "./constants/errorCodes.js";

/**
 * List of public methods to expose on the callable instance.
 * Explicitly defined to avoid binding internal or future methods.
 */
const PUBLIC_METHODS = [
  "request",
  "getUri",
  "get",
  "delete",
  "head",
  "options",
  "post",
  "put",
  "patch",
  "postForm",
  "putForm",
  "patchForm",
];

/**
 * Create a new Accessio instance with the given defaults.
 * @param {object} defaultConfig
 * @returns {Function} A callable instance that delegates to instance.request()
 */
function createInstance(defaultConfig) {
  const context = new Accessio(defaultConfig);

  // Create a function that delegates to Accessio.prototype.request
  // This allows `accessio(config)` and `accessio(url, config)` syntax
  const instance = function accessio(configOrUrl, config) {
    return context.request(configOrUrl, config);
  };

  // Bind only the explicitly listed public methods
  for (const key of PUBLIC_METHODS) {
    if (typeof context[key] === "function") {
      instance[key] = context[key].bind(context);
    }
  }

  // Copy instance properties
  instance.defaults = context.defaults;
  instance.interceptors = context.interceptors;

  return instance;
}

// Create the default instance
const accessio = createInstance(defaults);

/**
 * Create a new Accessio instance with custom defaults.
 * @param {object} instanceConfig - Configuration to merge with global defaults
 * @returns {Function} A new callable Accessio instance
 */
accessio.create = function create(instanceConfig) {
  return createInstance(mergeConfig(defaults, instanceConfig));
};

/**
 * Execute multiple concurrent requests.
 * @param {Array<Promise>} promises
 * @returns {Promise<Array>}
 * @note Alias for Promise.all. Adds no extra behaviour — kept for compatibility
 *       with the Axios API and for semantic readability.
 */
accessio.all = function all(promises) {
  return Promise.all(promises);
};

/**
 * Helper to spread an array of responses to individual arguments.
 * @param {Function} callback
 * @returns {Function}
 * @deprecated In modern JavaScript use rest/spread syntax instead: `callback(...arr)`.
 *             Kept for compatibility with the Axios API.
 */
accessio.spread = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

/**
 * Check if an error is a cancellation error.
 * @param {*} value
 * @returns {boolean}
 */
accessio.isCancel = function isCancel(value) {
  return !!(value && value.isAccessioError && value.code === ERR_CANCELED);
};

/**
 * Check if a value is a AccessioError.
 * @param {*} value
 * @returns {boolean}
 */
accessio.isAccessioError = function isAccessioError(value) {
  return (
    value instanceof AccessioError || !!(value && value.isAccessioError === true)
  );
};

// Expose classes and utilities
accessio.AccessioError = AccessioError;
accessio.Accessio = Accessio;
accessio.mergeConfig = mergeConfig;
accessio.buildURL = buildURL;
accessio.InterceptorManager = InterceptorManager;
accessio.createRateLimiter = createRateLimiter;

// Default export
export default accessio;

// Named exports
export {
  Accessio,
  AccessioError,
  mergeConfig,
  buildURL,
  InterceptorManager,
  createInstance,
  createRateLimiter,
  logRequest,
  logResponse,
  logError,
};
