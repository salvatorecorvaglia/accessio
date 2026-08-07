import { setBasicAuth } from '../helpers/auth';
import { buildFetchHeaders, flattenHeaders, removeContentType } from '../helpers/flattenHeaders';
import { defaultMemoryCache } from '../helpers/memoryCache';
import settle from '../helpers/settle';
import transformData from '../helpers/transformData';
import type {
  AccessioRequestConfig,
  AccessioResponse,
  CacheProvider,
  TransformFunction,
} from '../types';
import AccessioError from './accessioError';
import buildURL from './buildURL';
import fetchAdapter from './fetchAdapter';
import { assertAllowedProtocol } from './protocol';

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

function resolveCacheProvider(cache: AccessioRequestConfig['cache']): CacheProvider {
  return typeof cache === 'object' ? cache : defaultMemoryCache;
}

function settleResponse(
  response: AccessioResponse,
  config: AccessioRequestConfig,
): Promise<AccessioResponse> {
  return new Promise<AccessioResponse>((resolve, reject) => {
    settle(
      resolve as (value: AccessioResponse) => void,
      reject as (reason: AccessioError) => void,
      response,
      config,
    );
  });
}

/**
 * Turns a raw adapter response into the value handed back to one caller: applies
 * `transformResponse`, enforces `validateStatus`, and stores the result if caching is on.
 *
 * The cache write happens *after* settling on purpose. Storing first meant a 4xx/5xx was
 * written to the cache and then replayed to later callers as a resolved success, silently
 * bypassing `validateStatus`.
 *
 * `cloneRaw` is set only for the dedupe fan-out, where a single adapter response is shared
 * by several callers and each needs an independent copy. A single-consumer response is its
 * caller's alone, so cloning it would be pure overhead.
 */
async function finalizeAndSettle(
  raw: AccessioResponse,
  config: AccessioRequestConfig,
  options: { isGet: boolean; cacheKey: string; cloneRaw: boolean },
): Promise<AccessioResponse> {
  const source = options.cloneRaw && config.cacheClone !== false ? cloneResponse(raw) : raw;
  const response = finalizeResponse(source, config);

  response.data = await transformData(
    buildTransformArray(config.transformResponse),
    response.data,
    response.headers,
    config,
    'response',
  );

  const settled = await settleResponse(response, config);

  // Schema validation runs on the transformed data of an accepted response: validating the
  // raw adapter output meant schemas saw pre-transform values (often still a string), and
  // a failing status surfaced as a schema error rather than the status error.
  if (config.schema) {
    try {
      settled.data =
        typeof config.schema.parseAsync === 'function'
          ? await config.schema.parseAsync(settled.data)
          : config.schema.parse(settled.data);
    } catch (schemaError) {
      throw AccessioError.from(
        schemaError instanceof Error ? schemaError : new Error(String(schemaError)),
        AccessioError.ERR_BAD_RESPONSE,
        config,
        settled.request,
        settled,
      );
    }
  }

  if (options.isGet && config.cache) {
    await resolveCacheProvider(config.cache).set(
      options.cacheKey,
      config.cacheClone !== false ? cloneResponse(settled) : settled,
      config.cacheTTL,
    );
  }

  return settled;
}

async function executeFetchRequest(
  config: AccessioRequestConfig,
  fullURL: string,
  flatHeaders: FlatHeaders,
): Promise<AccessioResponse> {
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
  return await fetchAdapter(config, fullURL, fetchOptions, requestStartTime);
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
    const cached = await resolveCacheProvider(config.cache).get(cacheKey);
    if (cached) {
      const clonedCached = config.cacheClone !== false ? cloneResponse(cached) : cached;
      const cachedView: AccessioResponse = {
        ...clonedCached,
        config,
      };
      // Replayed responses go through validateStatus too, so a caller that tightened
      // validateStatus is not handed a status it would have rejected on a live request.
      const settled = await settleResponse(cachedView, config);
      if (config.hooks?.onRequestResponse) {
        await config.hooks.onRequestResponse(settled);
      }
      return settled;
    }
  }

  if (isGet && config.dedupe) {
    let record = activeRequests.get(cacheKey);
    const isNew = !record;
    if (isNew) {
      const recordAbortController = new AbortController();
      const fetchConfig = { ...config, signal: recordAbortController.signal };

      const promise = executeFetchRequest(fetchConfig, fullURL, flatHeaders);

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
              const settled = await finalizeAndSettle(shared, sub.config, {
                isGet,
                cacheKey,
                cloneRaw: true,
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

  const promise = executeFetchRequest(config, fullURL, flatHeaders);

  try {
    const shared = await promise;
    const settled = await finalizeAndSettle(shared, config, { isGet, cacheKey, cloneRaw: false });

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

/**
 * Attaches the caller's own config to a response.
 *
 * Deliberately unredacted: this is the config the caller already holds, and redacting it
 * made `response.config.headers` read `[REDACTED]`, so callers could not inspect the
 * headers they had just sent. Redaction is applied to errors (see `redactConfig`), which
 * are the values that leak into logs and crash reporters.
 */
function finalizeResponse(
  shared: AccessioResponse,
  config: AccessioRequestConfig,
): AccessioResponse {
  return {
    ...shared,
    config,
  };
}
