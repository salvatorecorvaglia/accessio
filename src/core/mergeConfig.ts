import type { AccessioRequestConfig } from '../types';

function deepMerge(...sources: any[]): Record<string, any> {
  const result: Record<string, any> = Object.create(null);

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

      const value = source[key];

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
          result[key] = value;
        } else if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
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

const requestOnlyKeys = new Set<string>(['url', 'data', 'signal']);
const deepMergeKeys = new Set<string>(['headers', 'params', 'hooks']);

export default function mergeConfig(
  config1: AccessioRequestConfig = {},
  config2: AccessioRequestConfig = {},
): AccessioRequestConfig {
  const merged: any = Object.create(null);

  const keys1 = Object.keys(config1);
  for (let i = 0; i < keys1.length; i++) {
    const key = keys1[i];
    if (requestOnlyKeys.has(key)) continue;
    merged[key] = config1[key as keyof AccessioRequestConfig];
  }

  const keys2 = Object.keys(config2);
  for (let i = 0; i < keys2.length; i++) {
    const key = keys2[i];
    const val2 = config2[key as keyof AccessioRequestConfig];
    if (val2 !== undefined) {
      if (deepMergeKeys.has(key)) {
        const val1 = config1[key as keyof AccessioRequestConfig];
        merged[key] = deepMerge(val1 || {}, val2);
      } else {
        merged[key] = val2;
      }
    }
  }

  return merged;
}

export { deepMerge };
