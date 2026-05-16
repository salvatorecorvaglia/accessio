import buildURL from './buildURL';
import AccessioError from './accessioError';
import transformData from '../helpers/transformData';
import settle from '../helpers/settle';
import { flattenHeaders, removeContentType, buildFetchHeaders } from '../helpers/flattenHeaders';
import { setBasicAuth } from '../helpers/auth';
import fetchAdapter from './fetchAdapter';
import { defaultMemoryCache } from '../helpers/memoryCache';
import type { AccessioRequestConfig, AccessioResponse, TransformFunction } from '../types';

type HeadersConfig = Record<string, Record<string, string | string[]>>;

function buildTransformArray(
  transform: TransformFunction | TransformFunction[] | undefined,
): TransformFunction[] {
  if (!transform) return [];
  if (Array.isArray(transform)) return transform;
  return [transform];
}

const activeRequests = new Map<string, Promise<AccessioResponse>>();

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

  if (config.hooks?.onBeforeRequest) {
    await config.hooks.onBeforeRequest(config);
  }

  const isGet = (config.method || 'GET').toUpperCase() === 'GET';
  const cacheKey = isGet ? `GET:${fullURL}` : '';

  if (isGet && config.cache) {
    const cacheProvider = typeof config.cache === 'object' ? config.cache : defaultMemoryCache;
    const cached = await cacheProvider.get(cacheKey);
    if (cached) {
      if (config.hooks?.onRequestResponse) {
        await config.hooks.onRequestResponse(cached);
      }
      return cached;
    }
  }

  if (isGet && config.dedupe) {
    if (activeRequests.has(cacheKey)) {
      return activeRequests.get(cacheKey)!;
    }
  }

  const performRequest = async () => {
    const flatHeaders = flattenHeaders(config.headers as HeadersConfig | undefined, config.method);
    const requestTransforms = buildTransformArray(config.transformRequest);
    const requestData = await transformData(requestTransforms, config.data, flatHeaders, config);

    if (
      requestData === null ||
      requestData === undefined ||
      (typeof FormData !== 'undefined' && requestData instanceof FormData)
    ) {
      removeContentType(flatHeaders);
    }

    setBasicAuth(config, flatHeaders);

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
    );

    return new Promise<AccessioResponse>((resolve, reject) => {
      settle(
        resolve as (value: AccessioResponse) => void,
        reject as (reason: AccessioError) => void,
        response,
        config,
      );
    });
  };

  const promise = performRequest();

  if (isGet && config.dedupe) {
    activeRequests.set(cacheKey, promise);
    promise.finally(() => {
      activeRequests.delete(cacheKey);
    });
  }

  try {
    const response = await promise;

    if (isGet && config.cache) {
      const cacheProvider = typeof config.cache === 'object' ? config.cache : defaultMemoryCache;
      await cacheProvider.set(cacheKey, response, config.cacheTTL);
    }

    if (config.hooks?.onRequestResponse) {
      await config.hooks.onRequestResponse(response);
    }

    return response;
  } catch (error) {
    if (config.hooks?.onRequestError && error instanceof AccessioError) {
      await config.hooks.onRequestError(error);
    }
    throw error;
  }
}
