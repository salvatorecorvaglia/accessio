export default function parseHeaders(headers: any): Record<string, string | string[]> {
  const parsed: Record<string, string | string[]> = {};

  if (!headers) return parsed;

  const addHeader = (key: string, value: string) => {
    const k = key.toLowerCase();
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    const existing = Reflect.get(parsed, k);
    if (existing) {
      if (Array.isArray(existing)) {
        (existing as string[]).push(value);
      } else {
        Reflect.set(parsed, k, [existing as string, value]);
      }
    } else {
      Reflect.set(parsed, k, value);
    }
  };

  if (typeof headers.forEach === 'function') {
    headers.forEach((value: string, key: string) => {
      addHeader(key, value);
    });
    return parsed;
  }

  if (typeof headers === 'string') {
    headers.split('\n').forEach((line: string) => {
      const index = line.indexOf(':');
      if (index > 0) {
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        addHeader(key, value);
      }
    });
    return parsed;
  }

  if (typeof headers === 'object') {
    Object.keys(headers).forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      addHeader(key, Reflect.get(headers, key));
    });
    return parsed;
  }

  return parsed;
}
