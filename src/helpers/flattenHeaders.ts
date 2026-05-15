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

  if (headers['common']) {
    Object.assign(merged, headers['common']);
  }

  if (headers[methodLower]) {
    Object.assign(merged, headers[methodLower]);
  }

  for (const key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && !METHOD_KEYS.has(key)) {
      merged[key] = headers[key] as unknown as string | string[];
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
    if (Array.isArray(value)) {
      for (const v of value) {
        fetchHeaders.append(key, v);
      }
    } else {
      fetchHeaders.set(key, value);
    }
  }
  return fetchHeaders;
}
