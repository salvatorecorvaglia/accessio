import AccessioError from "../core/accessioError";
import type { TransformFunction, AccessioRequestConfig } from "../types";

export default function transformData(
  transforms: TransformFunction | TransformFunction[] | undefined,
  data: unknown,
  headers: Record<string, string>,
  config?: AccessioRequestConfig,
): unknown {
  if (!transforms || !Array.isArray(transforms)) {
    return data;
  }

  let result = data;

  for (const transform of transforms) {
    if (typeof transform === "function") {
      try {
        result = transform(result, headers);
      } catch (err) {
        throw AccessioError.from(
          err instanceof Error ? err : new Error(String(err)),
          AccessioError.ERR_BAD_REQUEST,
          config ?? null,
          null,
          null,
        );
      }
    }
  }

  return result;
}
