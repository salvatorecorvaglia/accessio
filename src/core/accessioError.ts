import ErrorCodes from "../constants/errorCodes";
import type { AccessioRequestConfig, AccessioResponse } from "../types";

export class AccessioError extends Error {
  static ERR_BAD_OPTION_VALUE: string = ErrorCodes.ERR_BAD_OPTION_VALUE;
  static ERR_BAD_OPTION: string = ErrorCodes.ERR_BAD_OPTION;
  static ECONNABORTED: string = ErrorCodes.ECONNABORTED;
  static ETIMEDOUT: string = ErrorCodes.ETIMEDOUT;
  static ERR_NETWORK: string = ErrorCodes.ERR_NETWORK;
  static ERR_FR_TOO_MANY_REDIRECTS: string =
    ErrorCodes.ERR_FR_TOO_MANY_REDIRECTS;
  static ERR_BAD_RESPONSE: string = ErrorCodes.ERR_BAD_RESPONSE;
  static ERR_BAD_REQUEST: string = ErrorCodes.ERR_BAD_REQUEST;
  static ERR_CANCELED: string = ErrorCodes.ERR_CANCELED;
  static ERR_NOT_SUPPORT: string = ErrorCodes.ERR_NOT_SUPPORT;
  static ERR_INVALID_URL: string = ErrorCodes.ERR_INVALID_URL;

  readonly code: string | null;
  readonly config: AccessioRequestConfig | null;
  readonly request: unknown;
  readonly response: AccessioResponse | null;
  readonly isAccessioError: true;
  cause?: Error;

  constructor(
    message: string,
    code: string | null,
    config: AccessioRequestConfig | null,
    request: unknown,
    response: AccessioResponse | null,
  ) {
    super(message);
    this.name = "AccessioError";
    this.code = code ?? null;
    this.config = config ?? null;
    this.request = request ?? null;
    this.response = response ?? null;
    this.isAccessioError = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AccessioError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.response ? this.response.status : null,
      config: this.config,
    };
  }

  static from(
    error: Error,
    code: string,
    config: AccessioRequestConfig | null,
    request: unknown,
    response: AccessioResponse | null,
  ): AccessioError {
    const accessioError = new AccessioError(
      error.message,
      code,
      config,
      request,
      response,
    );
    accessioError.cause = error;
    accessioError.stack = error.stack;
    return accessioError;
  }
}

export default AccessioError;
