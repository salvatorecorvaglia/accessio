/**
 * AccessioError — Custom error class for Accessio HTTP client.
 * Provides structured error information including config, request, response, and error code.
 */

import ErrorCodes from '../constants/errorCodes.js';

class AccessioError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} [code] - Error code (e.g. 'ECONNABORTED', 'ERR_NETWORK', 'ERR_BAD_REQUEST')
   * @param {object} [config] - Request configuration that triggered the error
   * @param {object} [request] - The request object
   * @param {object} [response] - The response object (if available)
   */
  constructor(message, code, config, request, response) {
    super(message);
    this.name = 'AccessioError';
    this.code = code || null;
    this.config = config || null;
    this.request = request || null;
    this.response = response || null;
    this.isAccessioError = true;

    // Capture stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AccessioError);
    }
  }

  /**
   * Returns a JSON-serializable representation of the error.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.response ? this.response.status : null,
      config: this.config,
    };
  }

  /**
   * Create a AccessioError from an existing Error object.
   * @param {Error} error - Source error
   * @param {string} [code] - Error code
   * @param {object} [config] - Request configuration
   * @param {object} [request] - The request object
   * @param {object} [response] - The response object
   * @returns {AccessioError}
   */
  static from(error, code, config, request, response) {
    const accessioError = new AccessioError(
      error.message,
      code,
      config,
      request,
      response
    );
    accessioError.cause = error;
    accessioError.stack = error.stack;
    return accessioError;
  }
}

// Expose error codes as static properties (mirrors ErrorCodes for convenience)
Object.assign(AccessioError, ErrorCodes);

export default AccessioError;
