/**
 * Parse response headers from a Headers object into a plain object.
 * All header names are lowercased for consistency.
 *
 * @param {Headers} headers - Fetch API Headers object
 * @returns {object} Plain object of header key-value pairs
 */
export default function parseHeaders(headers) {
  const parsed = {};

  if (!headers) return parsed;

  // Handle Fetch API Headers object
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      parsed[key.toLowerCase()] = value;
    });
    return parsed;
  }

  // Handle raw header string (fallback)
  if (typeof headers === 'string') {
    headers.split('\n').forEach(line => {
      const index = line.indexOf(':');
      if (index > 0) {
        const key = line.substring(0, index).trim().toLowerCase();
        const value = line.substring(index + 1).trim();
        parsed[key] = value;
      }
    });
    return parsed;
  }

  // Handle plain object
  if (typeof headers === 'object') {
    Object.keys(headers).forEach(key => {
      parsed[key.toLowerCase()] = headers[key];
    });
    return parsed;
  }

  return parsed;
}
