import AccessioError from '../core/accessioError.js';

/**
 * Apply an array of transform functions to data.
 *
 * @param {Array<Function>} transforms - Array of transform functions
 * @param {*} data - The data to transform
 * @param {object} [headers] - Request/response headers (passed to transforms)
 * @param {object} [config] - Request config for error context (optional)
 * @returns {*} Transformed data
 */
export default function transformData(transforms, data, headers, config) {
  if (!transforms || !Array.isArray(transforms)) {
    return data;
  }

  let result = data;

  for (const transform of transforms) {
    if (typeof transform === 'function') {
      try {
        result = transform(result, headers);
      } catch (err) {
        // Catch exceptions thrown by transforms and rethrow as AccessioError
        throw AccessioError.from(
          err instanceof Error ? err : new Error(String(err)),
          AccessioError.ERR_BAD_REQUEST,
          config
        );
      }
    }
  }

  return result;
}
