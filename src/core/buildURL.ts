import type { ParamsSerializer } from '../types';

function serializeParams(
  params: Record<string, unknown>,
  paramsSerializer?: ParamsSerializer,
): string {
  if (!params) return '';

  if (typeof paramsSerializer === 'function') {
    return paramsSerializer(params);
  }

  if (typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams) {
    return params.toString();
  }

  const parts: string[] = [];

  function encode(prefix: string, value: unknown): void {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          encode(`${prefix}[${index}]`, item);
        } else {
          encode(prefix, item);
        }
      });
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      Object.keys(value as Record<string, unknown>).forEach((key) => {
        encode(`${prefix}[${key}]`, (value as Record<string, unknown>)[key]);
      });
    } else {
      const encodedValue = value instanceof Date ? value.toISOString() : value;
      parts.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(encodedValue as string)}`);
    }
  }

  Object.keys(params).forEach((key) => {
    encode(key, params[key]);
  });

  return parts.join('&');
}

function combineURLs(baseURL: string, relativeURL: string): string {
  if (!baseURL) return relativeURL || '';
  if (!relativeURL) return baseURL;

  let baseEnd = baseURL.length;
  while (baseEnd > 0 && baseURL[baseEnd - 1] === '/') baseEnd--;

  let relStart = 0;
  while (relStart < relativeURL.length && relativeURL[relStart] === '/') relStart++;

  return baseURL.slice(0, baseEnd) + '/' + relativeURL.slice(relStart);
}

function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)/i.test(url);
}

export default function buildURL(
  url: string,
  baseURL?: string,
  params?: Record<string, unknown>,
  paramsSerializer?: ParamsSerializer,
): string {
  let fullURL = baseURL && !isAbsoluteURL(url) ? combineURLs(baseURL, url) : url || '';

  let finalParams = params;
  if (params && typeof params === 'object' && !(params instanceof URLSearchParams)) {
    if (fullURL.includes('{') || /:[a-zA-Z_]/.test(fullURL)) {
      const unusedParams: Record<string, unknown> = {};
      for (const key of Object.keys(params)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
        unusedParams[key] = (params as Record<string, unknown>)[key];
      }
      fullURL = fullURL.replace(
        /(?::([a-zA-Z_][a-zA-Z0-9_]*))|(?:{([a-zA-Z_][a-zA-Z0-9_]*)})/g,
        (match, p1, p2) => {
          const key = p1 || p2;
          if (
            key &&
            Object.prototype.hasOwnProperty.call(unusedParams, key) &&
            unusedParams[key] !== undefined
          ) {
            const val = unusedParams[key];
            delete unusedParams[key];
            return encodeURIComponent(String(val));
          }
          return match;
        },
      );
      finalParams = unusedParams;
    }
  }

  const serialized = serializeParams(finalParams as Record<string, unknown>, paramsSerializer);
  if (serialized) {
    const hashIndex = fullURL.indexOf('#');
    let fragment = '';
    if (hashIndex !== -1) {
      fragment = fullURL.slice(hashIndex);
      fullURL = fullURL.slice(0, hashIndex);
    }
    fullURL += (fullURL.indexOf('?') === -1 ? '?' : '&') + serialized + fragment;
  }

  return fullURL;
}

export { serializeParams, combineURLs, isAbsoluteURL };
