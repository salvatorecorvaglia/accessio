import { ERR_BAD_OPTION } from '../constants/errorCodes';
import { setBasicAuth } from '../helpers/auth';
import { buildFetchHeaders, flattenHeaders, removeContentType } from '../helpers/flattenHeaders';
import { defaultMemoryCache } from '../helpers/memoryCache';
import settle from '../helpers/settle';
import transformData from '../helpers/transformData';
import type { AccessioRequestConfig, AccessioResponse, TransformFunction } from '../types';
import AccessioError, { redactConfig } from './accessioError';
import buildURL from './buildURL';
import fetchAdapter from './fetchAdapter';

type HeadersConfig = Record<string, Record<string, string | string[]>>;
type FlatHeaders = Record<string, string | string[]>;

function buildCacheKey(
  config: AccessioRequestConfig,
  fullURL: string,
  flatHeaders: FlatHeaders,
): string {
  if (typeof config.cacheKeySerializer === 'function') {
    return config.cacheKeySerializer(config, fullURL, flatHeaders);
  }
  const method = (config.method || 'GET').toUpperCase();
  const withCreds = config.withCredentials ? '1' : '0';
  const respType = config.responseType || 'json';

  // Sort and serialize headers dynamically to prevent collisions,
  // excluding environment-specific transient headers.
  const serializedHeaders = Object.keys(flatHeaders)
    .sort()
    .filter(
      (k) =>
        !['user-agent', 'connection', 'host', 'content-length', 'accept-encoding'].includes(
          k.toLowerCase(),
        ),
    )
    .map((k) => {
      const val = flatHeaders[k];
      return `${k.toLowerCase()}=${Array.isArray(val) ? val.join(',') : val}`;
    })
    .join('&');

  return `${method}:${fullURL}|h:${serializedHeaders}|c=${withCreds}|t=${respType}`;
}

function buildTransformArray(
  transform: TransformFunction | TransformFunction[] | undefined,
): TransformFunction[] {
  if (!transform) return [];
  if (Array.isArray(transform)) return transform;
  return [transform];
}

const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:'];

function assertAllowedProtocol(fullURL: string, config: AccessioRequestConfig): void {
  if (config.allowedProtocols === null) return;
  const allowed = config.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;

  let scheme: string | null = null;
  const match = /^([a-z][a-z\d+\-.]*):/i.exec(fullURL);
  if (match) scheme = `${match[1].toLowerCase()}:`;
  if (!scheme) return;

  if (!allowed.includes(scheme)) {
    throw new AccessioError(
      `URL protocol "${scheme}" is not allowed. Allowed: ${allowed.join(', ')}. Set config.allowedProtocols to extend, or null to disable the check.`,
      ERR_BAD_OPTION,
      config,
      null,
      null,
    );
  }
}

interface Subscriber {
  config: AccessioRequestConfig;
  resolve: (res: AccessioResponse) => void;
  reject: (err: any) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface InFlightRecord {
  promise: Promise<AccessioResponse>;
  abortController: AbortController;
  subscribers: Set<Subscriber>;
}

const activeRequests = new Map<string, InFlightRecord>();
const MAX_ACTIVE_REQUESTS = 1024;

export function __activeRequestsSize(): number {
  return activeRequests.size;
}

function trackActiveRequest(key: string, record: InFlightRecord): void {
  activeRequests.set(key, record);
  while (activeRequests.size > MAX_ACTIVE_REQUESTS) {
    const oldest = activeRequests.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    const oldRecord = activeRequests.get(oldest);
    if (oldRecord) {
      oldRecord.abortController.abort(new Error('Evicted from active requests cache'));
    }
    activeRequests.delete(oldest);
  }
}

function createCanceledError(config: AccessioRequestConfig): AccessioError {
  const reason = config.signal?.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Request aborted';
  const err = new AccessioError(message, AccessioError.ERR_CANCELED, config, null, null);
  if (reason instanceof Error) {
    err.cause = reason;
  }
  return err;
}

export default async function dispatchRequest(
  config: AccessioRequestConfig,
): Promise<AccessioResponse> {
  const fullURL =
    config._builtUrl ||
    buildURL(
      config.url ?? '',
      config.baseURL,
      config.params as Record<string, unknown> | undefined,
      config.paramsSerializer,
    );

  assertAllowedProtocol(fullURL, config);

  if (config.hooks?.onBeforeRequest) {
    await config.hooks.onBeforeRequest(config);
  }

  const flatHeaders = flattenHeaders(config.headers as HeadersConfig | undefined, config.method);
  setBasicAuth(config, flatHeaders);

  const isGet = (config.method || 'GET').toUpperCase() === 'GET';
  const cacheKey =
    isGet && (config.cache || config.dedupe) ? buildCacheKey(config, fullURL, flatHeaders) : '';

  if (isGet && config.cache) {
    const cacheProvider = typeof config.cache === 'object' ? config.cache : defaultMemoryCache;
    const cached = await cacheProvider.get(cacheKey);
    if (cached) {
      const clonedCached = config.cacheClone !== false ? cloneResponse(cached) : cached;
      const cachedView: AccessioResponse = {
        ...clonedCached,
        config: redactConfig(config) as typeof clonedCached.config,
      };
      if (config.hooks?.onRequestResponse) {
        await config.hooks.onRequestResponse(cachedView);
      }
      return cachedView;
    }
  }

  if (isGet && config.dedupe) {
    let record = activeRequests.get(cacheKey);
    const isNew = !record;
    if (isNew) {
      const recordAbortController = new AbortController();
      const fetchConfig = { ...config, signal: recordAbortController.signal };

      const performRequest = async (): Promise<AccessioResponse> => {
        const requestTransforms = buildTransformArray(fetchConfig.transformRequest);
        const requestData = await transformData(
          requestTransforms,
          fetchConfig.data,
          flatHeaders,
          fetchConfig,
        );

        if (
          requestData === null ||
          requestData === undefined ||
          (typeof FormData !== 'undefined' && requestData instanceof FormData)
        ) {
          removeContentType(flatHeaders);
        }

        const fetchOptions: RequestInit = {
          method: (fetchConfig.method || 'GET').toUpperCase(),
          headers: buildFetchHeaders(flatHeaders),
        };

        const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (
          methodsWithBody.includes(fetchOptions.method!) &&
          requestData !== undefined &&
          requestData !== null
        ) {
          fetchOptions.body = requestData as BodyInit;
        }

        if (fetchConfig.withCredentials) {
          fetchOptions.credentials = 'include';
        }

        if (fetchConfig.dispatcher) {
          (fetchOptions as any).dispatcher = fetchConfig.dispatcher;
        }
        if (fetchConfig.agent) {
          (fetchOptions as any).agent = fetchConfig.agent;
        }

        const requestStartTime = Date.now();
        const response = await fetchAdapter(fetchConfig, fullURL, fetchOptions, requestStartTime);

        return response;
      };

      const promise = performRequest();

      record = {
        promise,
        abortController: recordAbortController,
        subscribers: new Set<Subscriber>(),
      };

      trackActiveRequest(cacheKey, record);

      promise.then(
        async (shared) => {
          if (activeRequests.get(cacheKey) === record) {
            activeRequests.delete(cacheKey);
          }
          for (const sub of record!.subscribers) {
            if (sub.signal && sub.onAbort) {
              sub.signal.removeEventListener('abort', sub.onAbort);
            }
            try {
              const clonedShared = sub.config.cacheClone !== false ? cloneResponse(shared) : shared;
              const response = finalizeResponse(clonedShared, sub.config);

              const responseTransforms = buildTransformArray(sub.config.transformResponse);
              response.data = await transformData(
                responseTransforms,
                response.data,
                response.headers,
                sub.config,
                'response',
              );

              if (isGet && sub.config.cache) {
                const cacheProvider =
                  typeof sub.config.cache === 'object' ? sub.config.cache : defaultMemoryCache;
                await cacheProvider.set(
                  cacheKey,
                  sub.config.cacheClone !== false ? cloneResponse(response) : response,
                  sub.config.cacheTTL,
                );
              }

              const settled = await new Promise<AccessioResponse>((resolve, reject) => {
                settle(
                  resolve as (value: AccessioResponse) => void,
                  reject as (reason: AccessioError) => void,
                  response,
                  sub.config,
                );
              });

              if (sub.config.hooks?.onRequestResponse) {
                await sub.config.hooks.onRequestResponse(settled);
              }

              sub.resolve(settled);
            } catch (subErr) {
              let finalError = subErr;
              if (subErr instanceof AccessioError) {
                finalError = AccessioError.from(
                  subErr,
                  subErr.code || 'ERR_DEDUPE',
                  sub.config,
                  subErr.request,
                  subErr.response,
                );
              }
              if (sub.config.hooks?.onRequestError && finalError instanceof AccessioError) {
                await sub.config.hooks.onRequestError(finalError);
              }
              sub.reject(finalError);
            }
          }
        },
        (error) => {
          if (activeRequests.get(cacheKey) === record) {
            activeRequests.delete(cacheKey);
          }
          for (const sub of record!.subscribers) {
            if (sub.signal && sub.onAbort) {
              sub.signal.removeEventListener('abort', sub.onAbort);
            }
            let finalError = error;
            if (error instanceof AccessioError) {
              finalError = AccessioError.from(
                error,
                error.code || 'ERR_DEDUPE',
                sub.config,
                error.request,
                error.response,
              );
            }
            if (sub.config.hooks?.onRequestError && finalError instanceof AccessioError) {
              const hookResult = sub.config.hooks.onRequestError(finalError);
              if (hookResult && typeof (hookResult as any).catch === 'function') {
                (hookResult as any).catch(() => {});
              }
            }
            sub.reject(finalError);
          }
        },
      );
    }

    return new Promise<AccessioResponse>((resolve, reject) => {
      const subscriber: Subscriber = {
        config,
        resolve,
        reject,
        signal: config.signal,
      };

      if (config.signal) {
        if (config.signal.aborted) {
          reject(createCanceledError(config));
          return;
        }
        const onAbort = () => {
          record!.subscribers.delete(subscriber);
          reject(createCanceledError(config));
          if (record!.subscribers.size === 0) {
            record!.abortController.abort(config.signal!.reason);
          }
        };
        subscriber.onAbort = onAbort;
        config.signal.addEventListener('abort', onAbort, { once: true });
      }

      record!.subscribers.add(subscriber);
    });
  }

  const performRequest = async (): Promise<AccessioResponse> => {
    const requestTransforms = buildTransformArray(config.transformRequest);
    const requestData = await transformData(requestTransforms, config.data, flatHeaders, config);

    if (
      requestData === null ||
      requestData === undefined ||
      (typeof FormData !== 'undefined' && requestData instanceof FormData)
    ) {
      removeContentType(flatHeaders);
    }

    const fetchOptions: RequestInit = {
      method: (config.method || 'GET').toUpperCase(),
      headers: buildFetchHeaders(flatHeaders),
    };

    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (
      methodsWithBody.includes(fetchOptions.method!) &&
      requestData !== undefined &&
      requestData !== null
    ) {
      fetchOptions.body = requestData as BodyInit;
    }

    if (config.withCredentials) {
      fetchOptions.credentials = 'include';
    }

    if (config.dispatcher) {
      (fetchOptions as any).dispatcher = config.dispatcher;
    }
    if (config.agent) {
      (fetchOptions as any).agent = config.agent;
    }

    const requestStartTime = Date.now();
    const response = await fetchAdapter(config, fullURL, fetchOptions, requestStartTime);

    return response;
  };

  const promise = performRequest();

  try {
    const shared = await promise;
    const clonedShared = config.cacheClone !== false ? cloneResponse(shared) : shared;
    const response = finalizeResponse(clonedShared, config);

    const responseTransforms = buildTransformArray(config.transformResponse);
    response.data = await transformData(
      responseTransforms,
      response.data,
      response.headers,
      config,
      'response',
    );

    if (isGet && config.cache) {
      const cacheProvider = typeof config.cache === 'object' ? config.cache : defaultMemoryCache;
      await cacheProvider.set(
        cacheKey,
        config.cacheClone !== false ? cloneResponse(response) : response,
        config.cacheTTL,
      );
    }

    const settled = await new Promise<AccessioResponse>((resolve, reject) => {
      settle(
        resolve as (value: AccessioResponse) => void,
        reject as (reason: AccessioError) => void,
        response,
        config,
      );
    });

    if (config.hooks?.onRequestResponse) {
      await config.hooks.onRequestResponse(settled);
    }

    return settled;
  } catch (error) {
    if (config.hooks?.onRequestError && error instanceof AccessioError) {
      await config.hooks.onRequestError(error);
    }
    throw error;
  }
}

function cloneResponse(response: AccessioResponse): AccessioResponse {
  let clonedData = response.data;
  if (response.data && typeof response.data === 'object') {
    if (
      !(typeof File !== 'undefined' && response.data instanceof File) &&
      !(typeof Blob !== 'undefined' && response.data instanceof Blob) &&
      !(typeof ArrayBuffer !== 'undefined' && response.data instanceof ArrayBuffer) &&
      !(typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(response.data)) &&
      !(typeof Buffer !== 'undefined' && Buffer.isBuffer(response.data)) &&
      !(typeof ReadableStream !== 'undefined' && response.data instanceof ReadableStream)
    ) {
      try {
        if (typeof structuredClone === 'function') {
          clonedData = structuredClone(response.data);
        } else {
          clonedData = JSON.parse(JSON.stringify(response.data));
        }
      } catch {
        clonedData = Array.isArray(response.data) ? [...response.data] : { ...response.data };
      }
    }
  }
  return {
    ...response,
    headers: { ...response.headers },
    data: clonedData,
  };
}

function finalizeResponse(
  shared: AccessioResponse,
  config: AccessioRequestConfig,
): AccessioResponse {
  return {
    ...shared,
    config: redactConfig(config) as typeof shared.config,
  };
}
