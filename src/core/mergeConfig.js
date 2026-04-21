/**
 * Merge two configuration objects with intelligent strategy.
 * Priority: config2 (per-request) > config1 (instance defaults)
 *
 * Different properties are merged differently:
 * - Some properties are taken from config2 only (url, method, data)
 * - Some are deeply merged (headers)
 * - Others follow a standard override pattern
 *
 * @module mergeConfig
 * @example
 * ```js
 * import { mergeConfig } from 'accessio';
 *
 * const defaults = { baseURL: 'https://api.example.com', timeout: 5000 };
 * const request = { url: '/users', timeout: 10000 };
 *
 * mergeConfig(defaults, request);
 * // => { baseURL: 'https://api.example.com', url: '/users', timeout: 10000 }
 *
 * // Headers are deep-merged
 * mergeConfig(
 *   { headers: { Authorization: 'Bearer token' } },
 *   { headers: { 'X-Custom': 'value' } }
 * );
 * // => { headers: { Authorization: 'Bearer token', 'X-Custom': 'value' } }
 * ```
 */

/**
 * Deep merge one or more objects. Arrays are replaced, not concatenated.
 * @param {...object} sources - Objects to merge (later sources take precedence)
 * @returns {object} A new merged object
 */
function deepMerge(...sources) {
  const result = {};

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const key of Object.keys(source)) {
      const value = source[key];

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Preserve special objects by reference — don't try to deep merge them
        if (
          value instanceof Date || value instanceof RegExp ||
          value instanceof Map || value instanceof Set ||
          value instanceof Error ||
          (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
          (typeof Blob !== 'undefined' && value instanceof Blob)
        ) {
          result[key] = value;
        } else if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          // If the result already has a plain object for this key, deep merge
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = deepMerge(value);
        }
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

// Properties that should come from config2 only (request-specific).
// NOTE: `signal` is intentionally request-only — a per-request AbortSignal should
// not bleed into instance defaults, as signals are single-use objects.
const requestOnlyKeys = new Set(['url', 'data', 'signal']);

// Properties that require deep merge (like headers)
const deepMergeKeys = new Set(['headers']);

/**
 * Merge two configurations.
 * @param {object} config1 - Base configuration (instance defaults)
 * @param {object} [config2] - Override configuration (per-request)
 * @returns {object} Merged configuration
 */
export default function mergeConfig(config1 = {}, config2 = {}) {
  const merged = {};

  const allKeys = new Set([
    ...Object.keys(config1),
    ...Object.keys(config2)
  ]);

  for (const key of allKeys) {
    if (requestOnlyKeys.has(key)) {
      // Request-only: only from config2 (url, method, data, signal)
      if (config2[key] !== undefined) {
        merged[key] = config2[key];
      }
    } else if (deepMergeKeys.has(key)) {
      // Deep merge (headers)
      merged[key] = deepMerge(config1[key] || {}, config2[key] || {});
    } else {
      // Standard override: config2 wins if defined, else config1
      merged[key] = config2[key] !== undefined ? config2[key] : config1[key];
    }
  }

  return merged;
}

export { deepMerge };
