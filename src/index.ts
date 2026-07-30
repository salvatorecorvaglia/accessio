import Accessio from './accessio';
import { ERR_CANCELED } from './constants/errorCodes';
import AccessioError from './core/accessioError';
import buildURL from './core/buildURL';
import mergeConfig from './core/mergeConfig';
import defaults from './defaults';
import { logError, logRequest, logResponse } from './helpers/debug';
import { createRateLimiter } from './helpers/rateLimiter';
import InterceptorManager from './interceptors/interceptorManager';
import type { AccessioRequestConfig } from './types';

function createInstance(defaultConfig: AccessioRequestConfig) {
  const context = new Accessio(defaultConfig);

  const instance: any = function accessio(
    configOrUrl: string | AccessioRequestConfig,
    config?: AccessioRequestConfig,
  ) {
    return context.request(configOrUrl, config);
  };

  for (const key of Accessio.publicMethods) {
    const method: any = (context as any)[key];
    if (typeof method === 'function') {
      instance[key] = method.bind(context);
    }
  }

  instance.defaults = context.defaults;
  instance.interceptors = context.interceptors;
  instance.all = function all(promises: any[]): Promise<any[]> {
    return Promise.all(promises);
  };
  instance.spread = function spread<T>(callback: (...args: any[]) => T): (arr: any[]) => T {
    return function wrap(arr: any[]): T {
      return callback(...arr);
    };
  };
  instance.isCancel = function isCancel(value: any): boolean {
    return !!(value?.isAccessioError && value.code === ERR_CANCELED);
  };
  instance.isAccessioError = function isAccessioError(value: any): boolean {
    return (
      value instanceof AccessioError ||
      !!(value && typeof value === 'object' && value.isAccessioError === true)
    );
  };
  instance.AccessioError = AccessioError;
  instance.Accessio = Accessio;
  instance.mergeConfig = mergeConfig;
  instance.buildURL = buildURL;
  instance.InterceptorManager = InterceptorManager;
  instance.createRateLimiter = createRateLimiter;

  return instance;
}

const accessio = createInstance(defaults);

function create(instanceConfig?: AccessioRequestConfig) {
  return createInstance(mergeConfig(defaults, instanceConfig));
}

accessio.create = create;

export default accessio;

export type * from './types';
export {
  Accessio,
  AccessioError,
  buildURL,
  createInstance,
  createRateLimiter,
  InterceptorManager,
  logError,
  logRequest,
  logResponse,
  mergeConfig,
};
