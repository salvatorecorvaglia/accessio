import type { AccessioRequestConfig } from '../types';

function deepMerge(...sources: any[]): Record<string, any> {
  const result: Record<string, any> = Object.create(null);

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

      const value = Reflect.get(source, key);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (
          value instanceof Date ||
          value instanceof RegExp ||
          value instanceof Map ||
          value instanceof Set ||
          value instanceof Error ||
          (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
          (typeof Blob !== 'undefined' && value instanceof Blob)
        ) {
          Reflect.set(result, key, value);
        } else if (
          Reflect.get(result, key) &&
          typeof Reflect.get(result, key) === 'object' &&
          !Array.isArray(Reflect.get(result, key))
        ) {
          Reflect.set(result, key, deepMerge(Reflect.get(result, key), value));
        } else {
          Reflect.set(result, key, deepMerge(value));
        }
      } else if (value !== undefined) {
        Reflect.set(result, key, value);
      }
    }
  }

  return result;
}

const requestOnlyKeys = new Set<string>(['url', 'data', 'signal']);
const deepMergeKeys = new Set<string>(['headers']);

export default function mergeConfig(
  config1: AccessioRequestConfig = {},
  config2: AccessioRequestConfig = {},
): AccessioRequestConfig {
  const merged: any = Object.create(null);

  const allKeys = new Set<string>([...Object.keys(config1), ...Object.keys(config2)]);

  for (const key of allKeys) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    const val1 = Reflect.get(config1, key);
    const val2 = Reflect.get(config2, key);

    if (requestOnlyKeys.has(key)) {
      if (val2 !== undefined) {
        Reflect.set(merged, key, val2);
      }
    } else if (deepMergeKeys.has(key)) {
      Reflect.set(merged, key, deepMerge(val1 || {}, val2 || {}));
    } else {
      Reflect.set(merged, key, val2 !== undefined ? val2 : val1);
    }
  }

  return merged;
}

export { deepMerge };
