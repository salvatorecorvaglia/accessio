import AccessioError from './core/accessioError';
import buildURL from './core/buildURL';
import mergeConfig from './core/mergeConfig';
import dispatchRequest from './core/request';
import retryRequest from './core/retry';
import defaultsConfig from './defaults/index';
import { logError, logRequest, logResponse } from './helpers/debug';
import { rateLimitedRequest } from './helpers/rateLimiter';
import { toFormData } from './helpers/toFormData';
import InterceptorManager from './interceptors/interceptorManager';
import type {
  AccessioRequestConfig,
  AccessioResponse,
  InterceptorHandler,
  Interceptors,
} from './types';

function runRequestInterceptorsSync(
  startConfig: AccessioRequestConfig,
  interceptors: InterceptorHandler[],
): AccessioRequestConfig {
  let cfg = startConfig;
  let rejectReason: any = null;
  let isRejected = false;

  for (const interceptor of interceptors) {
    if (!isRejected) {
      try {
        if (interceptor.fulfilled) {
          cfg = (interceptor.fulfilled as any)(cfg) as AccessioRequestConfig;
          if (cfg && typeof (cfg as any).then === 'function') {
            throw new AccessioError(
              'Synchronous request interceptors cannot return a Promise.',
              AccessioError.ERR_BAD_OPTION,
              startConfig,
              null,
              null,
            );
          }
        }
      } catch (err) {
        rejectReason = err;
        isRejected = true;
      }
    } else if (interceptor.rejected) {
      try {
        cfg = interceptor.rejected(rejectReason) as AccessioRequestConfig;
        if (cfg && typeof (cfg as any).then === 'function') {
          throw new AccessioError(
            'Synchronous request interceptors cannot return a Promise.',
            AccessioError.ERR_BAD_OPTION,
            startConfig,
            null,
            null,
          );
        }
        isRejected = false;
      } catch (err) {
        rejectReason = err;
        isRejected = true;
      }
    }
  }

  if (isRejected) {
    throw rejectReason;
  }
  return cfg;
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

  const enrichedCfg = { ...cfg, _builtUrl: fullUrl };

  const dispatchFn = cfg.rateLimiter
    ? (config: AccessioRequestConfig) =>
        rateLimitedRequest(dispatchRequest, config.rateLimiter!, config)
    : dispatchRequest;

  return retryRequest(dispatchFn, enrichedCfg);
}

export class Accessio {
  static readonly publicMethods = [
    'request',
    'getUri',
    'get',
    'delete',
    'head',
    'options',
    'post',
    'put',
    'patch',
    'postForm',
    'putForm',
    'patchForm',
    'stream',
    'autoPaginate',
    'gql',
  ];

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

    let promise: Promise<any>;

    if (synchronous) {
      try {
        const finalCfg = runRequestInterceptorsSync(mergedConfig, requestInterceptors);
        promise = dispatchAndRetry(finalCfg);
      } catch (err) {
        promise = Promise.reject(err);
      }
    } else {
      promise = runRequestInterceptorsAsync(mergedConfig, requestInterceptors).then(
        (cfg: AccessioRequestConfig) => dispatchAndRetry(cfg),
      );
    }

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

    if (responseInterceptors.length > 0) {
      promise = promise.then(
        (value: AccessioResponse) =>
          this.runResponseInterceptors(value, false, responseInterceptors),
        (error: any) => this.runResponseInterceptors(error, true, responseInterceptors),
      );
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

  private async runResponseInterceptors(
    initialValue: any,
    initialRejected: boolean,
    interceptors: InterceptorHandler[],
  ): Promise<any> {
    let current = initialValue;
    let isRejected = initialRejected;
    for (const interceptor of interceptors) {
      if (!isRejected) {
        try {
          if (interceptor.fulfilled) {
            const result = (interceptor.fulfilled as any)(current);
            if (result && typeof result.then === 'function') {
              current = await result;
            } else {
              current = result;
            }
          }
        } catch (err) {
          current = err;
          isRejected = true;
        }
      } else if (interceptor.rejected) {
        try {
          const result = interceptor.rejected(current) as any;
          if (result && typeof result.then === 'function') {
            current = await result;
          } else {
            current = result;
          }
          isRejected = false;
        } catch (err) {
          current = err;
          isRejected = true;
        }
      }
    }
    if (isRejected) {
      throw current;
    }
    return current;
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
    const useBrackets = config?.formSerializer?.brackets ?? false;
    const formData =
      data && !(data instanceof FormData)
        ? toFormData(data, undefined, undefined, undefined, { brackets: useBrackets })
        : data;
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
    const merged = mergeConfig(config || {}, { method: 'get', url, responseType: 'stream' });
    if (config?.signal) {
      merged.signal = config.signal;
    }
    const response = await this.request<any>(merged);
    if (!response.data) return;

    const stream = response.data;
    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = function* (line: string) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') return;
        try {
          yield JSON.parse(dataStr);
        } catch (_e) {
          yield dataStr as any;
        }
      } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          yield JSON.parse(trimmed);
        } catch (_e) {
          yield trimmed;
        }
      } else if (trimmed) {
        yield trimmed;
      }
    };

    const handleChunk = function* (chunk: any) {
      const chunkStr =
        chunk instanceof Uint8Array || ArrayBuffer.isView(chunk) || chunk instanceof ArrayBuffer
          ? decoder.decode(chunk as any, { stream: true })
          : String(chunk);
      buffer += chunkStr;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        yield* processLine(line);
      }
    };

    if (typeof stream.getReader === 'function') {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield* handleChunk(value);
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // ignore errors on cancel
        }
        reader.releaseLock();
      }
    } else if (typeof stream[Symbol.asyncIterator] === 'function') {
      try {
        for await (const chunk of stream) {
          yield* handleChunk(chunk);
        }
      } finally {
        if (typeof stream.destroy === 'function') {
          try {
            stream.destroy();
          } catch {
            // ignore
          }
        }
      }
    } else {
      throw new Error('[Accessio] The response data is not a readable stream or async iterable.');
    }

    buffer += decoder.decode(new Uint8Array(), { stream: false });
    if (buffer.trim()) {
      yield* processLine(buffer);
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
      let items: any = null;

      if (currentConfig.paginateItems) {
        if (typeof currentConfig.paginateItems === 'function') {
          items = currentConfig.paginateItems(data);
        } else if (
          typeof currentConfig.paginateItems === 'string' &&
          data &&
          typeof data === 'object'
        ) {
          items = (data as any)[currentConfig.paginateItems];
        }
      } else {
        items = Array.isArray(data)
          ? data
          : data && typeof data === 'object'
            ? (data as any).data || (data as any).items || (data as any).results || null
            : null;
      }

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
        const merged = mergeConfig(currentConfig, { url: nextUrl });
        if (merged.params) {
          try {
            const dummyBase = 'http://dummy-base.com';
            const parsedUrl = new URL(nextUrl, dummyBase);
            for (const key of parsedUrl.searchParams.keys()) {
              delete merged.params[key];
            }
          } catch {
            merged.params = {};
          }
        }
        if (currentConfig.signal) {
          merged.signal = currentConfig.signal;
        }
        currentConfig = merged;
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
