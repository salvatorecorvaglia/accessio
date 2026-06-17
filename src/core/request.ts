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

const activeRequests = new Map<string, Promise<AccessioResponse>>();
const MAX_ACTIVE_REQUESTS = 1024;

export function __activeRequestsSize(): number {
  return activeRequests.size;
}

function trackActiveRequest(key: string, promise: Promise<AccessioResponse>): void {
  activeRequests.set(key, promise);
  // Evict the oldest entry if we've grown past the cap. Map preserves insertion order.
  while (activeRequests.size > MAX_ACTIVE_REQUESTS) {
    const oldest = activeRequests.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    activeRequests.delete(oldest);
  }
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
      const cachedView: AccessioResponse = {
        ...cached,
        config: redactConfig(config) as typeof cached.config,
      };
      if (config.hooks?.onRequestResponse) {
        await config.hooks.onRequestResponse(cachedView);
      }
      return cachedView;
    }
  }

  if (isGet && config.dedupe) {
    const inflight = activeRequests.get(cacheKey);
    if (inflight) {
      try {
        const shared = await inflight;
        const response = finalizeResponse(shared, config);
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
        let finalError = error;
        if (error instanceof AccessioError) {
          finalError = AccessioError.from(
            error,
            error.code || 'ERR_DEDUPE',
            config,
            error.request,
            error.response,
          );
        }
        if (config.hooks?.onRequestError && finalError instanceof AccessioError) {
          await config.hooks.onRequestError(finalError);
        }
        throw finalError;
      }
    }
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

    const responseTransforms = buildTransformArray(config.transformResponse);
    response.data = await transformData(
      responseTransforms,
      response.data,
      response.headers,
      config,
      'response',
    );

    return response;
  };

  const promise = performRequest();

  if (isGet && config.dedupe) {
    trackActiveRequest(cacheKey, promise);
    const cleanup = () => {
      if (activeRequests.get(cacheKey) === promise) {
        activeRequests.delete(cacheKey);
      }
    };
    promise.then(cleanup, cleanup);
  }

  try {
    const shared = await promise;
    const response = finalizeResponse(shared, config);

    if (isGet && config.cache) {
      const cacheProvider = typeof config.cache === 'object' ? config.cache : defaultMemoryCache;
      await cacheProvider.set(cacheKey, shared, config.cacheTTL);
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

function finalizeResponse(
  shared: AccessioResponse,
  config: AccessioRequestConfig,
): AccessioResponse {
  return {
    ...shared,
    config: redactConfig(config) as typeof shared.config,
  };
}
