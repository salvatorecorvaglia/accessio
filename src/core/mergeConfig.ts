import type { AccessioRequestConfig } from "../types";

function deepMerge(...sources: any[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;

    for (const key of Object.keys(source)) {
      const value = source[key];

      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (
          value instanceof Date ||
          value instanceof RegExp ||
          value instanceof Map ||
          value instanceof Set ||
          value instanceof Error ||
          (typeof ArrayBuffer !== "undefined" &&
            value instanceof ArrayBuffer) ||
          (typeof Blob !== "undefined" && value instanceof Blob)
        ) {
          result[key] = value;
        } else if (
          result[key] &&
          typeof result[key] === "object" &&
          !Array.isArray(result[key])
        ) {
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = deepMerge(value);
        }
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

const requestOnlyKeys = new Set<string>(["url", "data", "signal"]);
const deepMergeKeys = new Set<string>(["headers"]);

export default function mergeConfig(
  config1: AccessioRequestConfig = {},
  config2: AccessioRequestConfig = {},
): AccessioRequestConfig {
  const merged: any = {};

  const allKeys = new Set<string>([
    ...Object.keys(config1),
    ...Object.keys(config2),
  ]);

  for (const key of allKeys) {
    const val1 = config1[key as keyof AccessioRequestConfig];
    const val2 = config2[key as keyof AccessioRequestConfig];

    if (requestOnlyKeys.has(key)) {
      if (val2 !== undefined) {
        merged[key] = val2;
      }
    } else if (deepMergeKeys.has(key)) {
      merged[key] = deepMerge(val1 || {}, val2 || {});
    } else {
      merged[key] = val2 !== undefined ? val2 : val1;
    }
  }

  return merged;
}

export { deepMerge };
