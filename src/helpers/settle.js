import AccessioError from '../core/accessioError.js';

/**
 * Settle a promise based on the response status and validateStatus function.
 * Resolves if validateStatus returns true, rejects with AccessioError otherwise.
 *
 * @param {Function} resolve - Promise resolve function
 * @param {Function} reject - Promise reject function
 * @param {object} response - The response object
 * @param {object} config - The request configuration
 */
export default function settle(resolve, reject, response, config) {
  const validateStatus = config.validateStatus;

  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    const error = new AccessioError(
      `Request failed with status code ${response.status}`,
      response.status >= 400 && response.status < 500
        ? AccessioError.ERR_BAD_REQUEST
        : AccessioError.ERR_BAD_RESPONSE,
      config,
      response.request,
      response
    );
    reject(error);
  }
}
