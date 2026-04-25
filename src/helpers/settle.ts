import AccessioError from "../core/accessioError";
import type { AccessioResponse, AccessioRequestConfig } from "../types";

export default function settle(
  resolve: (value: AccessioResponse) => void,
  reject: (reason: AccessioError) => void,
  response: AccessioResponse,
  config: AccessioRequestConfig,
): void {
  const validateStatus = config.validateStatus;

  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    const error = new AccessioError(
      `Request failed with status code ${response.status}`,
      response.status >= 400 && response.status < 500
        ? AccessioError.ERR_BAD_REQUEST
        : AccessioError.ERR_BAD_RESPONSE,
      config,
      response.request,
      response,
    );
    reject(error);
  }
}
