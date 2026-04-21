/**
 * Build a full URL from baseURL, url path, and params.
 * Handles query string serialization including nested objects and arrays.
 *
 * @module buildURL
 * @example
 * ```js
 * import { buildURL } from 'accessio';
 *
 * // Simple URL
 * buildURL('/users', 'https://api.example.com');
 * // => 'https://api.example.com/users'
 *
 * // With query params
 * buildURL('/users', 'https://api.example.com', { page: 1, limit: 10 });
 * // => 'https://api.example.com/users?page=1&limit=10'
 *
 * // With custom serializer
 * buildURL('/users', 'https://api.example.com', { tags: ['a', 'b'] }, (p) => `tags=${p.tags.join(',')}`);
 * // => 'https://api.example.com/users?tags=a,b'
 * ```
 */

/**
 * Serialize a params object into a URL query string.
 * @param {object} params - Parameters to serialize
 * @param {Function} [paramsSerializer] - Custom serializer function
 * @returns {string} Serialized query string (without leading '?')
 */
function serializeParams(params, paramsSerializer) {
  if (!params) return '';

  // Use custom serializer if provided
  if (typeof paramsSerializer === 'function') {
    return paramsSerializer(params);
  }

  // Native URLSearchParams support
  if (typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams) {
    return params.toString();
  }

  const parts = [];

  /**
   * Recursively encode params, supporting nested objects and arrays.
   * @param {string} prefix - Current key prefix
   * @param {*} value - Value to encode
   */
  function encode(prefix, value) {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          encode(`${prefix}[${index}]`, item);
        } else {
          encode(`${prefix}[]`, item);
        }
      });
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      Object.keys(value).forEach(key => {
        encode(`${prefix}[${key}]`, value[key]);
      });
    } else {
      const encodedValue = value instanceof Date
        ? value.toISOString()
        : value;
      parts.push(
        `${encodeURIComponent(prefix)}=${encodeURIComponent(encodedValue)}`
      );
    }
  }

  Object.keys(params).forEach(key => {
    encode(key, params[key]);
  });

  return parts.join('&');
}

/**
 * Combines a base URL with a relative URL.
 * @param {string} baseURL - The base URL
 * @param {string} relativeURL - The relative URL
 * @returns {string} Combined URL
 */
function combineURLs(baseURL, relativeURL) {
  if (!baseURL) return relativeURL || '';
  if (!relativeURL) return baseURL;

  // Remove trailing slashes from base (without regex to avoid ReDoS)
  let base = baseURL;
  while (base.endsWith('/')) {
    base = base.slice(0, -1);
  }

  // Remove leading slashes from relative (without regex to avoid ReDoS)
  let relative = relativeURL;
  while (relative.startsWith('/')) {
    relative = relative.slice(1);
  }

  return `${base}/${relative}`;
}

/**
 * Determines if a URL is absolute (has protocol or starts with //).
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isAbsoluteURL(url) {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * Build the final URL with baseURL, path, and serialized params.
 *
 * @param {string} url - The URL path
 * @param {string} [baseURL] - The base URL to prepend
 * @param {object} [params] - Query parameters
 * @param {Function} [paramsSerializer] - Custom params serializer
 * @returns {string} The fully constructed URL
 *
 * @note URL fragments (`#hash`) are stripped when `params` are provided,
 *       because fragments are client-side only and must not be sent to the server.
 *       This is intentional — append fragments manually after the call if needed.
 */
export default function buildURL(url, baseURL, params, paramsSerializer) {
  // Combine baseURL and url if url is relative
  let fullURL = (baseURL && !isAbsoluteURL(url))
    ? combineURLs(baseURL, url)
    : url || '';

  // Serialize and append params
  const serialized = serializeParams(params, paramsSerializer);
  if (serialized) {
    // Check if URL already has query params
    const hashIndex = fullURL.indexOf('#');
    if (hashIndex !== -1) {
      fullURL = fullURL.slice(0, hashIndex);
    }
    fullURL += (fullURL.indexOf('?') === -1 ? '?' : '&') + serialized;
  }

  return fullURL;
}

// Export helper functions for testing
export { serializeParams, combineURLs, isAbsoluteURL };
