import buildURL from './buildURL';
import AccessioError from './accessioError';
import transformData from '../helpers/transformData';
import settle from '../helpers/settle';
import { flattenHeaders, removeContentType, buildFetchHeaders } from '../helpers/flattenHeaders';
import { setBasicAuth } from '../helpers/auth';
import fetchAdapter from './fetchAdapter';
import type { AccessioRequestConfig, AccessioResponse, TransformFunction } from '../types';

type HeadersConfig = Record<string, Record<string, string | string[]>>;

function buildTransformArray(
  transform: TransformFunction | TransformFunction[] | undefined,
): TransformFunction[] {
  if (!transform) return [];
  if (Array.isArray(transform)) return transform;
  return [transform];
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

  response.data = await transformData(responseTransforms, response.data, response.headers, config);

  return new Promise<AccessioResponse>((resolve, reject) => {
    settle(
      resolve as (value: AccessioResponse) => void,
      reject as (reason: AccessioError) => void,
      response,
      config,
    );
  });
}
