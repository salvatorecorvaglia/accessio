export default function parseHeaders(headers: any): Record<string, string> {
  const parsed: Record<string, string> = {};

  if (!headers) return parsed;

  if (typeof headers.forEach === "function") {
    headers.forEach((value: string, key: string) => {
      parsed[key.toLowerCase()] = value;
    });
    return parsed;
  }

  if (typeof headers === "string") {
    headers.split("\n").forEach((line: string) => {
      const index = line.indexOf(":");
      if (index > 0) {
        const key = line.substring(0, index).trim().toLowerCase();
        const value = line.substring(index + 1).trim();
        parsed[key] = value;
      }
    });
    return parsed;
  }

  if (typeof headers === "object") {
    Object.keys(headers).forEach((key) => {
      parsed[key.toLowerCase()] = headers[key];
    });
    return parsed;
  }

  return parsed;
}
