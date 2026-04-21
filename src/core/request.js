/**
 * Core request engine — wraps fetch() with the full Accessio feature set.
 *
 * Handles: URL construction, headers, timeout, abort signals,
 * response parsing, transform functions, and progress tracking.
 */

import buildURL from './buildURL.js';
import AccessioError from './accessioError.js';
import parseHeaders from '../helpers/parseHeaders.js';
import transformData from '../helpers/transformData.js';
import settle from '../helpers/settle.js';

/**
 * Module-level Set: allocated once for all requests.
 * Avoids reallocating an Array on every flattenHeaders call.
 */
const METHOD_KEYS = new Set(['common', 'delete', 'get', 'head', 'options', 'post', 'put', 'patch']);

/**
 * Flatten headers from the config, merging common + method-specific + custom.
 *
 * @param {object} headers - Headers config with possible `common`, method keys
 * @param {string} method - HTTP method (lowercase)
 * @returns {object} Flat headers object
 */
function flattenHeaders(headers, method) {
  if (!headers) return {};

  const merged = {};
  const methodLower = (method || 'get').toLowerCase();

  // Merge common headers
  if (headers.common) {
    Object.assign(merged, headers.common);
  }

  // Merge method-specific headers
  if (headers[methodLower]) {
    Object.assign(merged, headers[methodLower]);
  }

  // Merge any remaining headers that aren't common or method-specific keys
  for (const key in headers) {
    if (Object.hasOwn(headers, key) && !METHOD_KEYS.has(key)) {
      merged[key] = headers[key];
    }
  }

  return merged;
}

/**
 * Remove Content-Type header (case-insensitive) from a headers object.
 * Used when no body is present or when FormData should set its own boundary.
 *
 * @param {object} headers - Headers object to modify in place
 */
function removeContentType(headers) {
  const key = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
  if (key) {
    delete headers[key];
  }
}

/**
 * Execute an HTTP request using fetch().
 *
 * @param {object} config - The fully merged request configuration
 * @returns {Promise<object>} Promise resolving to a Accessio response object
 */
export default function dispatchRequest(config) {
  const fullURL = config._builtUrl || buildURL(
    config.url,
    config.baseURL,
    config.params,
    config.paramsSerializer
  );

  // Flatten headers
  const flatHeaders = flattenHeaders(config.headers, config.method);

  // Apply transformRequest to the data
  const requestData = transformData(
    config.transformRequest,
    config.data,
    flatHeaders,
    config
  );

  if (
    requestData === null || requestData === undefined ||
    (typeof FormData !== 'undefined' && requestData instanceof FormData)
  ) {
    removeContentType(flatHeaders);
  }

  // Handle Basic Auth
  if (config.auth) {
    const username = config.auth.username || '';
    const password = config.auth.password || '';
    const credentials = `${username}:${password}`;

    // btoa() does not handle UTF-8: use safe encoding with Node.js fallback
    let encoded;
    if (typeof Buffer !== 'undefined') {
      // Node.js: Buffer.from correctly handles any Unicode string
      encoded = Buffer.from(credentials).toString('base64');
    } else {
      // Browser: avoid deprecated unescape using TextEncoder
      const bytes = new TextEncoder().encode(credentials);
      const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join('');
      encoded = btoa(binString);
    }

    flatHeaders['Authorization'] = `Basic ${encoded}`;
  }

  // Build fetch options
  const fetchOptions = {
    method: (config.method || 'GET').toUpperCase(),
    headers: flatHeaders,
  };

  // Add body for methods that support it
  const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (methodsWithBody.includes(fetchOptions.method) && requestData !== undefined && requestData !== null) {
    fetchOptions.body = requestData;
  }

  // Credentials
  if (config.withCredentials) {
    fetchOptions.credentials = 'include';
  }

  // Handle abort signal and timeout
  let abortController = null;
  let timeoutId = null;
  let isTimedOut = false;
  let onUserAbort = null;

  if (config.timeout && config.timeout > 0) {
    // Create an AbortController for timeout
    abortController = new AbortController();

    timeoutId = setTimeout(() => {
      isTimedOut = true;
      abortController.abort(
        new AccessioError(
          `timeout of ${config.timeout}ms exceeded`,
          AccessioError.ETIMEDOUT,
          config
        )
      );
    }, config.timeout);

    if (config.signal) {
      // Combine user signal + timeout signal
      if (typeof AbortSignal.any === 'function') {
        fetchOptions.signal = AbortSignal.any([config.signal, abortController.signal]);
      } else {
        // Fallback for Node 18: forward user abort to our controller
        if (config.signal.aborted) {
          abortController.abort(config.signal.reason);
        } else {
          onUserAbort = () => {
            abortController.abort(config.signal.reason);
          };
          config.signal.addEventListener('abort', onUserAbort, { once: true });
        }
        fetchOptions.signal = abortController.signal;
      }
    } else {
      fetchOptions.signal = abortController.signal;
    }
  } else if (config.signal) {
    // Only user signal, no timeout
    fetchOptions.signal = config.signal;
  }

  // Track request start time for duration
  const requestStartTime = Date.now();

  // Execute fetch
  return fetch(fullURL, fetchOptions)
    .then(async (fetchResponse) => {
      // Read response data based on responseType
      let responseData;
      const responseType = config.responseType || 'json';

      try {
        switch (responseType) {
          case 'arraybuffer':
            responseData = await fetchResponse.arrayBuffer();
            break;
          case 'blob':
            responseData = await fetchResponse.blob();
            break;
          case 'text':
            responseData = await fetchResponse.text();
            break;
          case 'stream':
            responseData = fetchResponse.body;
            break;
          case 'json':
          default:
            // Read as text first, then apply transformResponse
            responseData = await fetchResponse.text();
            break;
        }
      } catch (readError) {
        throw AccessioError.from(
          readError,
          AccessioError.ERR_BAD_RESPONSE,
          config,
          fetchResponse
        );
      }

      // Parse response headers
      const responseHeaders = parseHeaders(fetchResponse.headers);

      // Apply transformResponse to the dynamic data
      responseData = transformData(
        config.transformResponse,
        responseData,
        responseHeaders,
        config
      );

      // Build the response object
      const response = {
        data: responseData,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders,
        config: config,
        request: fetchResponse,
        duration: Date.now() - requestStartTime
      };

      // Settle: resolve or reject based on validateStatus
      return new Promise((resolve, reject) => {
        settle(resolve, reject, response, config);
      });
    })
    .catch((error) => {
      // If it's already a AccessioError, rethrow
      if (error instanceof AccessioError) {
        throw error;
      }

      // Handle abort/timeout errors
      if (error.name === 'AbortError') {
        // Use isTimedOut flag to reliably distinguish timeout from user cancellation
        if (isTimedOut) {
          throw new AccessioError(
            `timeout of ${config.timeout}ms exceeded`,
            AccessioError.ETIMEDOUT,
            config,
            null,
            null
          );
        }
        throw new AccessioError(
          'Request aborted',
          AccessioError.ERR_CANCELED,
          config,
          null,
          null
        );
      }

      // Network errors
      throw AccessioError.from(
        error,
        AccessioError.ERR_NETWORK,
        config,
        null,
        null
      );
    })
    .finally(() => {
      // Always clear the timeout — regardless of success, error, or interceptor throws
      if (timeoutId) clearTimeout(timeoutId);
      // Clean up event listener to prevent memory leaks
      if (config.signal && onUserAbort) {
        config.signal.removeEventListener('abort', onUserAbort);
      }
    });
}
