export default function parseHeaders(headers: any): Record<string, string | string[]> {
  const parsed: Record<string, string | string[]> = {};

  if (!headers) return parsed;

  const addHeader = (key: string, value: string) => {
    const k = key.toLowerCase();
    if (parsed[k]) {
      if (Array.isArray(parsed[k])) {
        (parsed[k] as string[]).push(value);
      } else {
        parsed[k] = [parsed[k] as string, value];
      }
    } else {
      parsed[k] = value;
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
      addHeader(key, headers[key]);
    });
    return parsed;
  }

  return parsed;
}
