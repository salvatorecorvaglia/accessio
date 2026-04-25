import buildURL from "./buildURL";
import AccessioError from "./accessioError";
import parseHeaders from "../helpers/parseHeaders";
import transformData from "../helpers/transformData";
import settle from "../helpers/settle";
import type {
  AccessioRequestConfig,
  AccessioResponse,
  TransformFunction,
} from "../types";

const METHOD_KEYS = new Set<string>([
  "common",
  "delete",
  "get",
  "head",
  "options",
  "post",
  "put",
  "patch",
]);

type HeadersConfig = Record<string, Record<string, string>>;

function flattenHeaders(
  headers: HeadersConfig | undefined,
  method?: string,
): Record<string, string> {
  if (!headers) return {};

  const merged: Record<string, string> = {};
  const methodLower = (method || "get").toLowerCase();

  if (headers["common"]) {
    Object.assign(merged, headers["common"]);
  }

  if (headers[methodLower]) {
    Object.assign(merged, headers[methodLower]);
  }

  for (const key in headers) {
    if (
      Object.prototype.hasOwnProperty.call(headers, key) &&
      !METHOD_KEYS.has(key)
    ) {
      merged[key] = headers[key] as unknown as string;
    }
  }

  return merged;
}

function removeContentType(headers: Record<string, string>): void {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === "content-type",
  );
  if (key) {
    delete headers[key];
  }
}

function buildTransformArray(
  transform: TransformFunction | TransformFunction[] | undefined,
): TransformFunction[] {
  if (!transform) return [];
  if (Array.isArray(transform)) return transform;
  return [transform];
}

export default function dispatchRequest(
  config: AccessioRequestConfig,
): Promise<AccessioResponse> {
  const fullURL =
    config._builtUrl ||
    buildURL(
      config.url ?? "",
      config.baseURL,
      config.params as Record<string, unknown> | undefined,
      config.paramsSerializer,
    );

  const flatHeaders = flattenHeaders(
    config.headers as HeadersConfig | undefined,
    config.method,
  );

  const requestTransforms = buildTransformArray(config.transformRequest);

  const requestData = transformData(
    requestTransforms,
    config.data,
    flatHeaders,
    config,
  );

  if (
    requestData === null ||
    requestData === undefined ||
    (typeof FormData !== "undefined" && requestData instanceof FormData)
  ) {
    removeContentType(flatHeaders);
  }

  if (config.auth) {
    const username = config.auth.username || "";
    const password = config.auth.password || "";
    const credentials = `${username}:${password}`;

    let encoded: string;
    if (typeof Buffer !== "undefined") {
      encoded = Buffer.from(credentials).toString("base64");
    } else {
      const bytes = new TextEncoder().encode(credentials);
      const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join(
        "",
      );
      encoded = btoa(binString);
    }

    flatHeaders["Authorization"] = `Basic ${encoded}`;
  }

  const fetchOptions: RequestInit = {
    method: (config.method || "GET").toUpperCase(),
    headers: flatHeaders,
  };

  const methodsWithBody = ["POST", "PUT", "PATCH", "DELETE"];
  if (
    methodsWithBody.includes(fetchOptions.method!) &&
    requestData !== undefined &&
    requestData !== null
  ) {
    fetchOptions.body = requestData as BodyInit;
  }

  if (config.withCredentials) {
    fetchOptions.credentials = "include";
  }

  let abortController: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isTimedOut = false;
  let onUserAbort: (() => void) | null = null;

  if (config.timeout && config.timeout > 0) {
    abortController = new AbortController();

    timeoutId = setTimeout(() => {
      isTimedOut = true;
      abortController!.abort(
        new AccessioError(
          `timeout of ${config.timeout}ms exceeded`,
          AccessioError.ETIMEDOUT,
          config,
          null,
          null,
        ),
      );
    }, config.timeout);

    if (config.signal) {
      if (typeof AbortSignal.any === "function") {
        fetchOptions.signal = AbortSignal.any([
          config.signal,
          abortController.signal,
        ]);
      } else {
        if (config.signal.aborted) {
          abortController.abort(config.signal.reason);
        } else {
          onUserAbort = () => {
            abortController!.abort(config.signal!.reason);
          };
          config.signal.addEventListener("abort", onUserAbort, {
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

  const requestStartTime = Date.now();

  return fetch(fullURL, fetchOptions)
    .then(async (fetchResponse) => {
      let responseData: unknown;
      const responseType = config.responseType || "json";

      try {
        switch (responseType) {
          case "arraybuffer":
            responseData = await fetchResponse.arrayBuffer();
            break;
          case "blob":
            responseData = await fetchResponse.blob();
            break;
          case "text":
            responseData = await fetchResponse.text();
            break;
          case "stream":
            responseData = fetchResponse.body;
            break;
          case "json":
          default:
            responseData = await fetchResponse.text();
            break;
        }
      } catch (readError) {
        throw AccessioError.from(
          readError as Error,
          AccessioError.ERR_BAD_RESPONSE,
          config,
          fetchResponse,
          null,
        );
      }

      const responseHeaders = parseHeaders(fetchResponse.headers);

      const responseTransforms = buildTransformArray(config.transformResponse);

      responseData = transformData(
        responseTransforms,
        responseData,
        responseHeaders,
        config,
      );

      const response: AccessioResponse = {
        data: responseData,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders,
        config: config,
        request: fetchResponse,
        duration: Date.now() - requestStartTime,
      };

      return new Promise<AccessioResponse>((resolve, reject) => {
        settle(
          resolve as (value: AccessioResponse) => void,
          reject as (reason: AccessioError) => void,
          response,
          config,
        );
      });
    })
    .catch((error) => {
      if (error instanceof AccessioError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        if (isTimedOut) {
          throw new AccessioError(
            `timeout of ${config.timeout}ms exceeded`,
            AccessioError.ETIMEDOUT,
            config,
            null,
            null,
          );
        }
        throw new AccessioError(
          "Request aborted",
          AccessioError.ERR_CANCELED,
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
    })
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      if (config.signal && onUserAbort) {
        config.signal.removeEventListener("abort", onUserAbort);
      }
    });
}
