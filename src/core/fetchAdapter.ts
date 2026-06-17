import parseHeaders from '../helpers/parseHeaders';
import type { AccessioRequestConfig, AccessioResponse } from '../types';
import AccessioError from './accessioError';

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
    case 'text':
      return await fetchResponse.text();
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
              text.length > 500 ? `${text.slice(0, 500)}…` : text
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

function assertValidURL(fullURL: string, config: AccessioRequestConfig): void {
  if (!fullURL || !/^[a-z][a-z\d+\-.]*:/i.test(fullURL)) return;
  try {
    new URL(fullURL);
  } catch {
    throw new AccessioError(
      `Invalid URL: ${fullURL}`,
      AccessioError.ERR_INVALID_URL,
      config,
      null,
      null,
    );
  }
}

interface AbortWiring {
  isTimedOut: () => boolean;
  cleanup: () => void;
}

function setupAbort(config: AccessioRequestConfig, fetchOptions: RequestInit): AbortWiring {
  if (
    config.timeout !== undefined &&
    (typeof config.timeout !== 'number' || Number.isNaN(config.timeout) || config.timeout < 0)
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
  const hasTimeout = !Number.isNaN(timeoutValue) && timeoutValue > 0;

  if (!hasTimeout) {
    if (config.signal) fetchOptions.signal = config.signal;
    return { isTimedOut: () => false, cleanup: () => {} };
  }

  let timedOut = false;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortController.abort(
      new AccessioError(
        `timeout of ${timeoutValue}ms exceeded`,
        AccessioError.ETIMEDOUT,
        config,
        null,
        null,
      ),
    );
  }, timeoutValue);

  let onUserAbort: (() => void) | null = null;

  if (config.signal) {
    if (typeof AbortSignal.any === 'function') {
      fetchOptions.signal = AbortSignal.any([config.signal, abortController.signal]);
    } else {
      if (config.signal.aborted) {
        abortController.abort(config.signal.reason);
      } else {
        onUserAbort = () => {
          if (!timedOut) abortController.abort(config.signal!.reason);
        };
        config.signal.addEventListener('abort', onUserAbort, { once: true });
      }
      fetchOptions.signal = abortController.signal;
    }
  } else {
    fetchOptions.signal = abortController.signal;
  }

  return {
    isTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (onUserAbort && config.signal) {
        config.signal.removeEventListener('abort', onUserAbort);
      }
    },
  };
}

function wrapDownloadProgress(fetchResponse: Response, config: AccessioRequestConfig): Response {
  if (!config.onDownloadProgress || !fetchResponse.body || config.responseType === 'stream') {
    return fetchResponse;
  }

  const contentLength = fetchResponse.headers.get('content-length');
  const total = contentLength ? Number.parseInt(contentLength, 10) : 0;
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
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: fetchResponse.headers,
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
  });
}

function classifyFetchError(
  error: unknown,
  config: AccessioRequestConfig,
  isTimedOut: boolean,
): AccessioError {
  if (error instanceof AccessioError) return error;

  if (isTimedOut) {
    return new AccessioError(
      `timeout of ${config.timeout}ms exceeded`,
      AccessioError.ETIMEDOUT,
      config,
      null,
      null,
    );
  }

  const isAbort =
    (error instanceof Error && error.name === 'AbortError') || !!config.signal?.aborted;
  if (isAbort) {
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

  return AccessioError.from(
    error instanceof Error ? error : new Error(String(error)),
    AccessioError.ERR_NETWORK,
    config,
    null,
    null,
  );
}

export default async function fetchAdapter(
  config: AccessioRequestConfig,
  fullURL: string,
  fetchOptions: RequestInit,
  requestStartTime: number,
): Promise<AccessioResponse> {
  assertValidURL(fullURL, config);

  const abort = setupAbort(config, fetchOptions);

  try {
    const fetchImpl = config.fetch || fetch;
    const rawResponse = await fetchImpl(fullURL, fetchOptions);
    const fetchResponse = wrapDownloadProgress(rawResponse, config);

    const contentLength = fetchResponse.headers.get('content-length');
    if (
      contentLength &&
      config.maxContentLength &&
      Number.parseInt(contentLength, 10) > config.maxContentLength
    ) {
      throw new AccessioError(
        `maxContentLength size of ${config.maxContentLength} exceeded`,
        AccessioError.ERR_BAD_RESPONSE,
        config,
        fetchResponse,
        null,
      );
    }

    let responseData: unknown;
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

    return {
      data: responseData,
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: parseHeaders(fetchResponse.headers),
      config,
      request: fetchResponse,
      duration: Date.now() - requestStartTime,
    };
  } catch (error) {
    throw classifyFetchError(error, config, abort.isTimedOut());
  } finally {
    abort.cleanup();
  }
}
