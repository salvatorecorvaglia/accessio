import AccessioError from './accessioError';
import parseHeaders from '../helpers/parseHeaders';
import type { AccessioRequestConfig, AccessioResponse } from '../types';

async function readResponseData(
  fetchResponse: Response,
  config: AccessioRequestConfig,
): Promise<unknown> {
  const responseType = config.responseType || 'json';
  switch (responseType) {
    case 'arraybuffer':
      return await fetchResponse.arrayBuffer();
    case 'blob':
      return await fetchResponse.blob();
    case 'stream':
      return fetchResponse.body;
    case 'json':
    default: {
      const contentType = fetchResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await fetchResponse.text();
        if (!text) return '';
        try {
          return JSON.parse(text);
        } catch (err) {
          throw new AccessioError(
            `Failed to parse JSON response: ${(err as Error).message}. Raw body: ${
              text.length > 500 ? text.slice(0, 500) + '…' : text
            }`,
            AccessioError.ERR_BAD_RESPONSE,
            config,
            fetchResponse,
            null,
          );
        }
      }
      return await fetchResponse.text();
    }
  }
}

export default async function fetchAdapter(
  config: AccessioRequestConfig,
  fullURL: string,
  fetchOptions: RequestInit,
  requestStartTime: number,
): Promise<AccessioResponse> {
  let abortController: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isTimedOut = false;
  let onUserAbort: (() => void) | null = null;

  if (
    config.timeout !== undefined &&
    (typeof config.timeout !== 'number' || isNaN(config.timeout) || config.timeout < 0)
  ) {
    throw new AccessioError(
      `Invalid timeout value: ${config.timeout}`,
      AccessioError.ERR_BAD_OPTION_VALUE,
      config,
      null,
      null,
    );
  }

  const timeoutValue = Number(config.timeout);
  if (!isNaN(timeoutValue) && timeoutValue > 0) {
    abortController = new AbortController();

    timeoutId = setTimeout(() => {
      isTimedOut = true;
      abortController!.abort(
        new AccessioError(
          `timeout of ${timeoutValue}ms exceeded`,
          AccessioError.ETIMEDOUT,
          config,
          null,
          null,
        ),
      );
    }, timeoutValue);

    if (config.signal) {
      if (typeof AbortSignal.any === 'function') {
        fetchOptions.signal = AbortSignal.any([config.signal, abortController.signal]);
      } else {
        if (config.signal.aborted) {
          abortController.abort(config.signal.reason);
        } else {
          onUserAbort = () => {
            if (!isTimedOut && abortController) {
              abortController.abort(config.signal!.reason);
            }
          };
          config.signal.addEventListener('abort', onUserAbort, {
            once: true,
          });
        }
        fetchOptions.signal = abortController.signal;
      }
    } else {
      fetchOptions.signal = abortController.signal;
    }
  } else if (config.signal) {
    fetchOptions.signal = config.signal;
  }

  try {
    const fetchImpl = config.fetch || fetch;
    let fetchResponse = await fetchImpl(fullURL, fetchOptions);

    if (config.onDownloadProgress && fetchResponse.body && config.responseType !== 'stream') {
      const contentLength = fetchResponse.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = fetchResponse.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              loaded += value.byteLength;
              config.onDownloadProgress!({ loaded, total });
              controller.enqueue(value);
            }
          } catch (e) {
            controller.error(e);
          }
        },
      });

      fetchResponse = new Response(stream, {
        headers: fetchResponse.headers,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
      });
    }

    let responseData: unknown;

    const contentLength = fetchResponse.headers.get('content-length');
    if (
      contentLength &&
      config.maxContentLength &&
      parseInt(contentLength, 10) > config.maxContentLength
    ) {
      throw new AccessioError(
        `maxContentLength size of ${config.maxContentLength} exceeded`,
        AccessioError.ERR_BAD_RESPONSE,
        config,
        fetchResponse,
        null,
      );
    }

    try {
      responseData = await readResponseData(fetchResponse, config);
      if (config.schema) {
        if (typeof config.schema.parseAsync === 'function') {
          responseData = await config.schema.parseAsync(responseData);
        } else {
          responseData = config.schema.parse(responseData);
        }
      }
    } catch (readError) {
      if (readError instanceof AccessioError) throw readError;
      throw AccessioError.from(
        readError as Error,
        AccessioError.ERR_BAD_RESPONSE,
        config,
        fetchResponse,
        null,
      );
    }

    const responseHeaders = parseHeaders(fetchResponse.headers);

    return {
      data: responseData,
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: responseHeaders,
      config: config,
      request: fetchResponse,
      duration: Date.now() - requestStartTime,
    };
  } catch (error) {
    if (error instanceof AccessioError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      if (isTimedOut) {
        throw new AccessioError(
          `timeout of ${config.timeout}ms exceeded`,
          AccessioError.ETIMEDOUT,
          config,
          null,
          null,
        );
      }
      throw new AccessioError('Request aborted', AccessioError.ERR_CANCELED, config, null, null);
    }

    if (
      error instanceof TypeError &&
      (error.message.toLowerCase().includes('url') || error.message.toLowerCase().includes('fetch'))
    ) {
      throw new AccessioError(
        `Invalid URL: ${fullURL}`,
        AccessioError.ERR_INVALID_URL,
        config,
        null,
        null,
      );
    }

    throw AccessioError.from(
      error instanceof Error ? error : new Error(String(error)),
      AccessioError.ERR_NETWORK,
      config,
      null,
      null,
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (config.signal && onUserAbort) {
      config.signal.removeEventListener('abort', onUserAbort);
    }
  }
}
