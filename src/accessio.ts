import InterceptorManager from './interceptors/interceptorManager';
import AccessioError from './core/accessioError';
import mergeConfig from './core/mergeConfig';
import dispatchRequest from './core/request';
import buildURL from './core/buildURL';
import retryRequest from './core/retry';
import { logRequest, logResponse, logError } from './helpers/debug';
import { rateLimitedRequest } from './helpers/rateLimiter';
import { toFormData } from './helpers/toFormData';
import type {
  AccessioRequestConfig,
  AccessioResponse,
  Interceptors,
  InterceptorHandler,
} from './types';
import defaultsConfig from './defaults/index';

function runRequestInterceptorsSync(
  startConfig: AccessioRequestConfig,
  interceptors: InterceptorHandler[],
): Promise<AccessioRequestConfig> {
  let cfg = startConfig;
  let rejectReason: any = null;
  let isRejected = false;

  for (const interceptor of interceptors) {
    if (!isRejected) {
      try {
        if (interceptor.fulfilled) {
          cfg = (interceptor.fulfilled as any)(cfg) as AccessioRequestConfig;
        }
      } catch (err) {
        rejectReason = err;
        isRejected = true;
      }
    } else if (interceptor.rejected) {
      try {
        cfg = interceptor.rejected(rejectReason) as AccessioRequestConfig;
        isRejected = false;
      } catch (err) {
        rejectReason = err;
        isRejected = true;
      }
    }
  }

  return isRejected ? Promise.reject(rejectReason) : Promise.resolve(cfg);
}

function runRequestInterceptorsAsync(
  startConfig: AccessioRequestConfig,
  interceptors: InterceptorHandler[],
): Promise<AccessioRequestConfig> {
  let promise: Promise<any> = Promise.resolve(startConfig);
  for (const interceptor of interceptors) {
    promise = promise.then(
      (value: any) => (interceptor.fulfilled ? (interceptor.fulfilled as any)(value) : value),
      interceptor.rejected ?? undefined,
    );
  }
  return promise as Promise<AccessioRequestConfig>;
}

function dispatchAndRetry(cfg: AccessioRequestConfig): Promise<AccessioResponse> {
  const fullUrl = buildURL(cfg.url ?? '', cfg.baseURL, cfg.params, cfg.paramsSerializer);
  logRequest(cfg, fullUrl);

  const enrichedCfg = fullUrl !== (cfg.url || '') ? { ...cfg, _builtUrl: fullUrl } : cfg;

  const dispatchFn = cfg.rateLimiter
    ? (config: AccessioRequestConfig) =>
        rateLimitedRequest(dispatchRequest, config.rateLimiter!, config)
    : dispatchRequest;

  return retryRequest(dispatchFn, enrichedCfg);
}

export class Accessio {
  defaults: AccessioRequestConfig;
  interceptors: Interceptors;

  constructor(instanceConfig: AccessioRequestConfig = {}) {
    this.defaults = mergeConfig(defaultsConfig, instanceConfig);
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  request<T = any>(
    configOrUrl: string | AccessioRequestConfig,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    if (typeof configOrUrl === 'string') {
      config = { ...config, url: configOrUrl };
    } else {
      config = configOrUrl ? { ...configOrUrl } : {};
    }

    const mergedConfig = mergeConfig(this.defaults, config);

    mergedConfig.method = (mergedConfig.method || 'get').toLowerCase();

    if (!mergedConfig.url && !mergedConfig.baseURL) {
      throw new AccessioError(
        'Request URL is required. Provide a `url` or `baseURL` in the config.',
        AccessioError.ERR_BAD_OPTION,
        mergedConfig,
        null,
        null,
      );
    }

    const { requestInterceptors, responseInterceptors, synchronous } =
      this.collectInterceptors(mergedConfig);

    let promise: Promise<any> = synchronous
      ? runRequestInterceptorsSync(mergedConfig, requestInterceptors)
      : runRequestInterceptorsAsync(mergedConfig, requestInterceptors);

    promise = promise.then((cfg: AccessioRequestConfig) => dispatchAndRetry(cfg));

    promise = promise.then(
      (value: AccessioResponse) => {
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
          return (interceptor.fulfilled as any)(value);
        }
        return value;
      }, interceptor.rejected ?? undefined);
    }

    return promise;
  }

  private collectInterceptors(mergedConfig: AccessioRequestConfig): {
    requestInterceptors: InterceptorHandler[];
    responseInterceptors: InterceptorHandler[];
    synchronous: boolean;
  } {
    const requestInterceptors: InterceptorHandler[] = [];
    const responseInterceptors: InterceptorHandler[] = [];
    let synchronous = true;

    this.interceptors.request.forEach((interceptor: InterceptorHandler) => {
      if (interceptor.runWhen && !interceptor.runWhen(mergedConfig)) return;
      synchronous = synchronous && interceptor.synchronous;
      requestInterceptors.unshift(interceptor);
    });

    this.interceptors.response.forEach((interceptor: InterceptorHandler) => {
      responseInterceptors.push(interceptor);
    });

    return { requestInterceptors, responseInterceptors, synchronous };
  }

  getUri(config?: AccessioRequestConfig): string {
    const merged = mergeConfig(this.defaults, config);
    return buildURL(merged.url ?? '', merged.baseURL, merged.params, merged.paramsSerializer);
  }

  get<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'get', url }));
  }

  delete<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'delete', url }));
  }

  head<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'head', url }));
  }

  options<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'options', url }));
  }

  post<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'post', url, data }));
  }

  put<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'put', url, data }));
  }

  patch<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'patch', url, data }));
  }

  private formRequest<T = any>(
    method: 'post' | 'put' | 'patch',
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    const formData = data && !(data instanceof FormData) ? toFormData(data) : data;
    return this.request<T>(
      mergeConfig(config || {}, {
        method,
        url,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  }

  postForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.formRequest<T>('post', url, data, config);
  }

  putForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.formRequest<T>('put', url, data, config);
  }

  patchForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.formRequest<T>('patch', url, data, config);
  }

  async *stream<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): AsyncGenerator<T, void, unknown> {
    const response = await this.request<ReadableStream<Uint8Array>>(
      mergeConfig(config || {}, { method: 'get', url, responseType: 'stream' }),
    );
    if (!response.data) return;

    const reader = response.data.getReader();
    try {
      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = function* (line: string) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const dataStr = line.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') return;
          try {
            yield JSON.parse(dataStr);
          } catch (e) {
            yield dataStr as any;
          }
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            yield JSON.parse(line);
          } catch (e) {
            // ignore partial json
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          yield* processLine(line);
        }
      }

      buffer += decoder.decode(new Uint8Array(), { stream: false });
      if (buffer.trim()) {
        yield* processLine(buffer);
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore errors on cancel
      }
      reader.releaseLock();
    }
  }

  async *autoPaginate<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): AsyncGenerator<T, void, unknown> {
    let nextUrl: string | null = url;
    let currentConfig = config || {};

    while (nextUrl) {
      const response: AccessioResponse<any> = await this.get(nextUrl, currentConfig);

      const data = response.data;
      const items = Array.isArray(data)
        ? data
        : data && typeof data === 'object'
          ? (data as any).data
          : null;

      if (Array.isArray(items)) {
        for (const item of items) {
          yield item;
        }
      }

      nextUrl =
        data && typeof data === 'object'
          ? (data as any).next || (data as any).links?.next || null
          : null;

      if (nextUrl) {
        currentConfig = mergeConfig(currentConfig, { url: nextUrl, params: {} });
      }
    }
  }

  gql<T = any>(
    url: string,
    query: string,
    variables?: Record<string, any>,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>> {
    return this.post<T>(url, { query, variables }, config);
  }
}

export default Accessio;
