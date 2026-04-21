/**
 * Default transform functions for Accessio HTTP client.
 *
 * Extracted here so they can be imported, referenced, and tested
 * independently from the defaults object.
 */

/**
 * Default request transform — serialises plain objects/arrays to JSON.
 *
 * Pass-through cases (no serialisation):
 *  - null / undefined
 *  - string, ArrayBuffer, Blob, FormData, URLSearchParams, ReadableStream
 *
 * For plain objects/arrays the function also sets `Content-Type:
 * application/json` on the headers if it has not already been set.
 *
 * @param {*} data - Request body data
 * @param {object} [headers] - Flat headers object (may be mutated)
 * @returns {*} Transformed data
 */
export function defaultTransformRequest(data, headers) {
  if (data === null || data === undefined) {
    return data;
  }

  // Pass through already-serialized or binary types
  if (
    typeof data === 'string' ||
    data instanceof ArrayBuffer ||
    (typeof Blob !== 'undefined' && data instanceof Blob) ||
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream)
  ) {
    return data;
  }

  // Serialize plain objects and arrays to JSON
  if (typeof data === 'object') {
    if (headers && typeof headers === 'object') {
      const hasContentType = Object.keys(headers).some(
        key => key.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json';
      }
    }
    return JSON.stringify(data);
  }

  return data;
}

/**
 * Default response transform — parses a JSON string into a JS object.
 *
 * If the string is not valid JSON it is returned as-is.
 *
 * @param {*} data - Raw response data (usually a string)
 * @returns {*} Parsed object, or original data if parsing fails
 */
export function defaultTransformResponse(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      // Not JSON — return as-is
    }
  }
  return data;
}
