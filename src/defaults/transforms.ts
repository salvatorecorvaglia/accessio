export function defaultTransformRequest(
  data: unknown,
  headers: Record<string, string>,
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (
    typeof data === 'string' ||
    data instanceof ArrayBuffer ||
    (typeof Blob !== 'undefined' && data instanceof Blob) ||
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream)
  ) {
    return data;
  }

  if (typeof data === 'object') {
    if (headers && typeof headers === 'object') {
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type',
      );
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json';
      }
    }
    return JSON.stringify(data);
  }

  return data;
}

export function defaultTransformResponse(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      // Not JSON — return as-is
    }
  }
  return data;
}
