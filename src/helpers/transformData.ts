import AccessioError from '../core/accessioError';
import type { AccessioRequestConfig, TransformFunction } from '../types';

export default async function transformData(
  transforms: TransformFunction | TransformFunction[] | undefined,
  data: unknown,
  headers: Record<string, string | string[]>,
  config?: AccessioRequestConfig,
  direction: 'request' | 'response' = 'request',
): Promise<unknown> {
  if (!transforms) {
    return data;
  }

  const transformList = Array.isArray(transforms) ? transforms : [transforms];

  let result = data;

  for (const transform of transformList) {
    if (typeof transform === 'function') {
      try {
        result = await transform(result, headers, config);
      } catch (err) {
        throw AccessioError.from(
          err instanceof Error ? err : new Error(String(err)),
          direction === 'response' ? AccessioError.ERR_BAD_RESPONSE : AccessioError.ERR_BAD_REQUEST,
          config ?? null,
          null,
          null,
        );
      }
    }
  }

  return result;
}
