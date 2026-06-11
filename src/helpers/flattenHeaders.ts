import AccessioError from '../core/accessioError';
import { ERR_BAD_OPTION } from '../constants/errorCodes';

const HEADER_FORBIDDEN_CHAR = /[\r\n\0]/;

function assertSafeHeader(name: string, value: string | string[]): void {
  if (typeof name !== 'string' || HEADER_FORBIDDEN_CHAR.test(name)) {
    throw new AccessioError(
      `Invalid header name "${String(name)}": CR, LF and NUL are not allowed`,
      ERR_BAD_OPTION,
      null,
      null,
      null,
    );
  }
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v === 'string' && HEADER_FORBIDDEN_CHAR.test(v)) {
      throw new AccessioError(
        `Invalid value for header "${name}": CR, LF and NUL are not allowed`,
        ERR_BAD_OPTION,
        null,
        null,
        null,
      );
    }
  }
}

const METHOD_KEYS = new Set<string>([
  'common',
  'delete',
  'get',
  'head',
  'options',
  'post',
  'put',
  'patch',
]);

type HeadersConfig = Record<string, Record<string, string | string[]>>;

export function flattenHeaders(
  headers: HeadersConfig | undefined,
  method?: string,
): Record<string, string | string[]> {
  if (!headers) return {};

  const merged: Record<string, string | string[]> = {};
  const methodLower = (method || 'get').toLowerCase();

  const setHeader = (target: Record<string, string | string[]>, key: string, value: any) => {
    const keyLower = key.toLowerCase();
    for (const existingKey of Object.keys(target)) {
      if (existingKey.toLowerCase() === keyLower) {
        delete target[existingKey];
      }
    }
    target[key] = value;
  };

  if (headers['common']) {
    Object.entries(headers['common']).forEach(([k, v]) => {
      setHeader(merged, k, v);
    });
  }

  if (headers[methodLower]) {
    Object.entries(headers[methodLower]).forEach(([k, v]) => {
      setHeader(merged, k, v);
    });
  }

  for (const key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && !METHOD_KEYS.has(key)) {
      setHeader(merged, key, headers[key]);
    }
  }

  return merged;
}

export function removeContentType(headers: Record<string, string | string[]>): void {
  const keys = Object.keys(headers).filter((k) => k.toLowerCase() === 'content-type');
  for (const key of keys) {
    delete headers[key];
  }
}

export function buildFetchHeaders(headers: Record<string, string | string[]>): Headers {
  const fetchHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    assertSafeHeader(key, value);
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== null) {
          fetchHeaders.append(key, v);
        }
      }
    } else {
      fetchHeaders.set(key, value);
    }
  }
  return fetchHeaders;
}
