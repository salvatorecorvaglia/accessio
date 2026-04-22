import { defaultTransformRequest, defaultTransformResponse } from './transforms';
import type { AccessioRequestConfig } from '../types';

const defaults: AccessioRequestConfig = {
  method: 'get',
  timeout: 0,
  headers: {
    common: {
      Accept: 'application/json, text/plain, */*',
    },
    delete: {},
    get: {},
    head: {},
    options: {},
    post: {
      'Content-Type': 'application/json',
    },
    put: {
      'Content-Type': 'application/json',
    },
    patch: {
      'Content-Type': 'application/json',
    },
  },
  transformRequest: [defaultTransformRequest],
  transformResponse: [defaultTransformResponse],
  validateStatus: function defaultValidateStatus(
    status: number,
  ): boolean {
    return status >= 200 && status < 300;
  },
  responseType: 'json',
  withCredentials: false,
};

export default defaults;
