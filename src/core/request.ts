import buildURL from './buildURL';
import AccessioError, { redactConfig } from './accessioError';
import { ERR_BAD_OPTION } from '../constants/errorCodes';
import transformData from '../helpers/transformData';
import settle from '../helpers/settle';
import { flattenHeaders, removeContentType, buildFetchHeaders } from '../helpers/flattenHeaders';
import { setBasicAuth } from '../helpers/auth';
import fetchAdapter from './fetchAdapter';
import { defaultMemoryCache } from '../helpers/memoryCache';
import type { AccessioRequestConfig, AccessioResponse, TransformFunction } from '../types';

type HeadersConfig = Record<string, Record<string, string | string[]>>;
type FlatHeaders = Record<string, string | string[]>;

function lookupHeader(headers: FlatHeaders, name: string): string {
  const target = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) {
      const v = headers[k];
      return Array.isArray(v) ? v.join(',') : (v ?? '');
    }
  }
  return '';
}

function buildCacheKey(
  config: AccessioRequestConfig,
  fullURL: string,
  flatHeaders: FlatHeaders,
): string {
  const method = (config.method || 'GET').toUpperCase();
  const auth = lookupHeader(flatHeaders, 'authorization');
  const accept = lookupHeader(flatHeaders, 'accept');
  const withCreds = config.withCredentials ? '1' : '0';
  const respType = config.responseType || 'json';
  return `${method}:${fullURL}|a=${auth}|x=${accept}|c=${withCreds}|t=${respType}`;
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
      `URL protocol "${scheme}" is not allowed. Allowed: ${allowed.join(', ')}. ` +
        'Set config.allowedProtocols to extend, or null to disable the check.',
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
  const cacheKey = isGet ? buildCacheKey(config, fullURL, flatHeaders) : '';

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
      const shared = await inflight;
      return finalizeResponse(shared, config);
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
