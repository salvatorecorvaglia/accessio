/**
 * Default configuration for Accessio instances.
 * These defaults can be overridden at the instance or per-request level.
 */

import { defaultTransformRequest, defaultTransformResponse } from './transforms.js';

const defaults = {
  // Default HTTP method
  method: 'get',

  // Timeout in milliseconds (0 = no timeout)
  timeout: 0,

  // Default headers per method and common
  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    },
    delete: {},
    get: {},
    head: {},
    options: {},
    post: {
      'Content-Type': 'application/json'
    },
    put: {
      'Content-Type': 'application/json'
    },
    patch: {
      'Content-Type': 'application/json'
    }
  },

  // Transform functions applied to request data before sending
  transformRequest: [defaultTransformRequest],

  // Transform functions applied to response data after receiving
  transformResponse: [defaultTransformResponse],

  // Determines if a given status code should resolve or reject the promise
  validateStatus: function defaultValidateStatus(status) {
    return status >= 200 && status < 300;
  },

  // Response type: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream'
  responseType: 'json',

  // Cross-site credentials
  withCredentials: false
};

export default defaults;
