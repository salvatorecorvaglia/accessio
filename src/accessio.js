/**
 * Accessio — Main class representing a configurable HTTP client instance.
 *
 * Each Accessio instance has its own defaults, interceptors, and methods.
 * The default export from the library is a pre-configured Accessio instance.
 */

import InterceptorManager from "./interceptors/interceptorManager.js";
import AccessioError from "./core/accessioError.js";
import mergeConfig from "./core/mergeConfig.js";
import dispatchRequest from "./core/request.js";
import buildURL from "./core/buildURL.js";
import retryRequest from "./core/retry.js";
import { logRequest, logResponse, logError } from "./helpers/debug.js";
import { rateLimitedRequest } from "./helpers/rateLimiter.js";

class Accessio {
  /**
   * Create a new Accessio instance.
   * @param {object} [instanceConfig] - Instance-specific default configuration
   */
  constructor(instanceConfig = {}) {
    this.defaults = instanceConfig;
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  /**
   * Core request method — all shorthand methods delegate to this.
   *
   * @param {string|object} configOrUrl - URL string or full config object
   * @param {object} [config] - Config when first argument is a URL
   * @returns {Promise<object>} Promise resolving to a Accessio response
   */
  request(configOrUrl, config) {
    // Support accessio('url', { ... }) syntax
    if (typeof configOrUrl === "string") {
      config = { ...config, url: configOrUrl };
    } else {
      config = configOrUrl ? { ...configOrUrl } : {};
    }

    // Merge with instance defaults
    const mergedConfig = mergeConfig(this.defaults, config);

    // Ensure method is lowercase
    mergedConfig.method = (mergedConfig.method || "get").toLowerCase();

    // Validate required URL
    if (!mergedConfig.url && !mergedConfig.baseURL) {
      throw new AccessioError(
        "Request URL is required. Provide a `url` or `baseURL` in the config.",
        AccessioError.ERR_BAD_OPTION,
        mergedConfig,
      );
    }

    // Build the interceptor chain
    // Request interceptors run in REVERSE order (last added runs first)
    // Response interceptors run in NORMAL order (first added runs first)
    const requestInterceptors = [];
    const responseInterceptors = [];

    this.interceptors.request.forEach((interceptor) => {
      // Check runWhen condition
      if (interceptor.runWhen && !interceptor.runWhen(mergedConfig)) {
        return;
      }
      requestInterceptors.unshift(interceptor);
    });

    this.interceptors.response.forEach((interceptor) => {
      responseInterceptors.push(interceptor);
    });

    // Execute the chain: request interceptors → dispatch → response interceptors
    let promise = Promise.resolve(mergedConfig);

    // Apply request interceptors
    for (const interceptor of requestInterceptors) {
      promise = promise.then(interceptor.fulfilled, interceptor.rejected);
    }

    // Dispatch the actual request (with retry, rate limiting, and debug support)
    promise = promise.then((cfg) => {
      // Build the URL once here and reuse it for both logging
      // and dispatchRequest (via cfg._builtUrl), avoiding N+1 builds during retries.
      const fullUrl = buildURL(
        cfg.url,
        cfg.baseURL,
        cfg.params,
        cfg.paramsSerializer,
      );

      // Log the outgoing request in debug mode (pass pre-built URL to avoid double-computation)
      logRequest(cfg, fullUrl);

      // Inject the pre-built URL into the config: dispatchRequest will use it directly
      // without recomputing it. The _ prefix signals this is an internal field.
      const enrichedCfg =
        fullUrl !== (cfg.url || "") ? { ...cfg, _builtUrl: fullUrl } : cfg;

      // Determine dispatch function: wrap with rate limiter if provided
      const dispatchFn = cfg.rateLimiter
        ? (config) => rateLimitedRequest(dispatchRequest, cfg.rateLimiter, config)
        : dispatchRequest;

      // Wrap dispatch with retry logic
      return retryRequest(dispatchFn, enrichedCfg);
    });

    // Debug logging for responses and errors
    promise = promise.then(
      (response) => {
        logResponse(response);
        return response;
      },
      (error) => {
        logError(error, mergedConfig);
        throw error;
      },
    );

    // Apply response interceptors
    for (const interceptor of responseInterceptors) {
      promise = promise.then(interceptor.fulfilled, interceptor.rejected);
    }

    return promise;
  }

  /**
   * Get the URL that would be built for the given config.
   * Useful for debugging.
   * @param {object} config
   * @returns {string}
   */
  getUri(config) {
    const merged = mergeConfig(this.defaults, config);
    return buildURL(
      merged.url,
      merged.baseURL,
      merged.params,
      merged.paramsSerializer,
    );
  }

  // ── Shorthand methods ───────────────────────────────────────

  /**
   * Send a GET request.
   * @param {string} url
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  get(url, config) {
    return this.request(mergeConfig(config || {}, { method: "get", url }));
  }

  /**
   * Send a DELETE request.
   * @param {string} url
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  delete(url, config) {
    return this.request(mergeConfig(config || {}, { method: "delete", url }));
  }

  /**
   * Send a HEAD request.
   * @param {string} url
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  head(url, config) {
    return this.request(mergeConfig(config || {}, { method: "head", url }));
  }

  /**
   * Send an OPTIONS request.
   * @param {string} url
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  options(url, config) {
    return this.request(mergeConfig(config || {}, { method: "options", url }));
  }

  /**
   * Send a POST request.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  post(url, data, config) {
    return this.request(
      mergeConfig(config || {}, { method: "post", url, data }),
    );
  }

  /**
   * Send a PUT request.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  put(url, data, config) {
    return this.request(
      mergeConfig(config || {}, { method: "put", url, data }),
    );
  }

  /**
   * Send a PATCH request.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  patch(url, data, config) {
    return this.request(
      mergeConfig(config || {}, { method: "patch", url, data }),
    );
  }

  /**
   * Send a POST request with multipart/form-data Content-Type.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  postForm(url, data, config) {
    return this.request(
      mergeConfig(config || {}, {
        method: "post",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }

  /**
   * Send a PUT request with multipart/form-data Content-Type.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  putForm(url, data, config) {
    return this.request(
      mergeConfig(config || {}, {
        method: "put",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }

  /**
   * Send a PATCH request with multipart/form-data Content-Type.
   * @param {string} url
   * @param {*} [data]
   * @param {object} [config]
   * @returns {Promise<object>}
   */
  patchForm(url, data, config) {
    return this.request(
      mergeConfig(config || {}, {
        method: "patch",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }
}

export default Accessio;
