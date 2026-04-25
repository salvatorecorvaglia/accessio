import InterceptorManager from "./interceptors/interceptorManager";
import AccessioError from "./core/accessioError";
import mergeConfig from "./core/mergeConfig";
import dispatchRequest from "./core/request";
import buildURL from "./core/buildURL";
import retryRequest from "./core/retry";
import { logRequest, logResponse, logError } from "./helpers/debug";
import { rateLimitedRequest } from "./helpers/rateLimiter";
import type {
  AccessioRequestConfig,
  AccessioResponse,
  Interceptors,
  InterceptorHandler,
} from "./types";

export class Accessio {
  defaults: AccessioRequestConfig;
  interceptors: Interceptors;

  constructor(instanceConfig: AccessioRequestConfig = {}) {
    this.defaults = instanceConfig;
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  request<T = any>(
    configOrUrl: string | AccessioRequestConfig,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    if (typeof configOrUrl === "string") {
      config = { ...config, url: configOrUrl };
    } else {
      config = configOrUrl ? { ...configOrUrl } : {};
    }

    const mergedConfig = mergeConfig(this.defaults, config);

    mergedConfig.method = (mergedConfig.method || "get").toLowerCase();

    if (!mergedConfig.url && !mergedConfig.baseURL) {
      throw new AccessioError(
        "Request URL is required. Provide a `url` or `baseURL` in the config.",
        AccessioError.ERR_BAD_OPTION,
        mergedConfig,
        null,
        null,
      );
    }

    const requestInterceptors: any[] = [];
    const responseInterceptors: any[] = [];

    this.interceptors.request.forEach((interceptor: InterceptorHandler) => {
      if (interceptor.runWhen && !interceptor.runWhen(mergedConfig)) {
        return;
      }
      requestInterceptors.unshift(interceptor);
    });

    this.interceptors.response.forEach((interceptor: InterceptorHandler) => {
      responseInterceptors.push(interceptor);
    });

    let promise: Promise<any> = Promise.resolve(mergedConfig);

    for (const interceptor of requestInterceptors) {
      promise = promise.then((value: any) => {
        if (interceptor.fulfilled) {
          return interceptor.fulfilled(value);
        }
        return value;
      }, interceptor.rejected);
    }

    promise = promise.then((cfg: any) => {
      const fullUrl = buildURL(
        cfg.url ?? "",
        cfg.baseURL,
        cfg.params,
        cfg.paramsSerializer,
      );

      logRequest(cfg, fullUrl);

      const enrichedCfg =
        fullUrl !== (cfg.url || "") ? { ...cfg, _builtUrl: fullUrl } : cfg;

      const dispatchFn = cfg.rateLimiter
        ? (config: AccessioRequestConfig) =>
            rateLimitedRequest(dispatchRequest, config.rateLimiter!, config)
        : dispatchRequest;

      return retryRequest(dispatchFn, enrichedCfg);
    });

    promise = promise.then(
      (value: any) => {
        logResponse(value);
        return value;
      },
      (error: any) => {
        logError(error, mergedConfig);
        throw error;
      },
    );

    for (const interceptor of responseInterceptors) {
      promise = promise.then((value: any) => {
        if (interceptor.fulfilled) {
          return interceptor.fulfilled(value);
        }
        return value;
      }, interceptor.rejected);
    }

    return promise;
  }

  getUri(config?: AccessioRequestConfig): string {
    const merged = mergeConfig(this.defaults, config);
    return buildURL(
      merged.url ?? "",
      merged.baseURL,
      merged.params,
      merged.paramsSerializer,
    );
  }

  get<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: "get", url }));
  }

  delete<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, { method: "delete", url }),
    );
  }

  head<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: "head", url }));
  }

  options<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, { method: "options", url }),
    );
  }

  post<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, { method: "post", url, data }),
    );
  }

  put<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, { method: "put", url, data }),
    );
  }

  patch<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, { method: "patch", url, data }),
    );
  }

  postForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, {
        method: "post",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }

  putForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, {
        method: "put",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }

  patchForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(
      mergeConfig(config || {}, {
        method: "patch",
        url,
        data,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  }
}

export default Accessio;
