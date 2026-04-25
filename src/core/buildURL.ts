import type { ParamsSerializer } from "../types";

function serializeParams(
  params: Record<string, unknown>,
  paramsSerializer?: ParamsSerializer,
): string {
  if (!params) return "";

  if (typeof paramsSerializer === "function") {
    return paramsSerializer(params);
  }

  if (
    typeof URLSearchParams !== "undefined" &&
    params instanceof URLSearchParams
  ) {
    return params.toString();
  }

  const parts: string[] = [];

  function encode(prefix: string, value: unknown): void {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          encode(`${prefix}[${index}]`, item);
        } else {
          encode(`${prefix}[]`, item);
        }
      });
    } else if (typeof value === "object" && !(value instanceof Date)) {
      Object.keys(value as Record<string, unknown>).forEach((key) => {
        encode(`${prefix}[${key}]`, (value as Record<string, unknown>)[key]);
      });
    } else {
      const encodedValue = value instanceof Date ? value.toISOString() : value;
      parts.push(
        `${encodeURIComponent(prefix)}=${encodeURIComponent(
          encodedValue as string,
        )}`,
      );
    }
  }

  Object.keys(params).forEach((key) => {
    encode(key, params[key]);
  });

  return parts.join("&");
}

function combineURLs(baseURL: string, relativeURL: string): string {
  if (!baseURL) return relativeURL || "";
  if (!relativeURL) return baseURL;

  let base = baseURL;
  while (base.endsWith("/")) {
    base = base.slice(0, -1);
  }

  let relative = relativeURL;
  while (relative.startsWith("/")) {
    relative = relative.slice(1);
  }

  return `${base}/${relative}`;
}

function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

export default function buildURL(
  url: string,
  baseURL?: string,
  params?: Record<string, unknown>,
  paramsSerializer?: ParamsSerializer,
): string {
  let fullURL =
    baseURL && !isAbsoluteURL(url) ? combineURLs(baseURL, url) : url || "";

  const serialized = serializeParams(
    params as Record<string, unknown>,
    paramsSerializer,
  );
  if (serialized) {
    const hashIndex = fullURL.indexOf("#");
    if (hashIndex !== -1) {
      fullURL = fullURL.slice(0, hashIndex);
    }
    fullURL += (fullURL.indexOf("?") === -1 ? "?" : "&") + serialized;
  }

  return fullURL;
}

export { serializeParams, combineURLs, isAbsoluteURL };
