import ErrorCodes from '../constants/errorCodes';
import type { AccessioRequestConfig, AccessioResponse } from '../types';

function redactHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    const value = (headers as Record<string, unknown>)[key];
    if (/^authorization$/i.test(key) || /^cookie$/i.test(key) || /^set-cookie$/i.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactHeaders(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const SENSITIVE_BODY_KEY = /^(password|passwd|pwd|token|access_token|refresh_token|id_token|authorization|api[_-]?key|secret|client[_-]?secret|cookie|set[_-]?cookie|private[_-]?key|session)$/i;

export function redactBody(value: unknown, seen?: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(value as object)) return '[Circular]';
  visited.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactBody(item, visited));
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    if (SENSITIVE_BODY_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactBody(v, visited);
    }
  }
  return out;
}

export function redactConfig(config: AccessioRequestConfig | null): AccessioRequestConfig | null {
  if (!config) return config;
  const clone = { ...config } as AccessioRequestConfig & { auth?: unknown };
  if ('auth' in clone) delete clone.auth;
  if (clone.headers) clone.headers = redactHeaders(clone.headers) as typeof clone.headers;
  return clone;
}

export class AccessioError extends Error {
  static ERR_BAD_OPTION_VALUE: string = ErrorCodes.ERR_BAD_OPTION_VALUE;
  static ERR_BAD_OPTION: string = ErrorCodes.ERR_BAD_OPTION;
  static ECONNABORTED: string = ErrorCodes.ECONNABORTED;
  static ETIMEDOUT: string = ErrorCodes.ETIMEDOUT;
  static ERR_NETWORK: string = ErrorCodes.ERR_NETWORK;
  static ERR_FR_TOO_MANY_REDIRECTS: string = ErrorCodes.ERR_FR_TOO_MANY_REDIRECTS;
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
  override name = 'AccessioError' as const;

  constructor(
    message: string,
    code: string | null,
    config: AccessioRequestConfig | null,
    request: unknown,
    response: AccessioResponse | null,
  ) {
    super(message);
    this.name = 'AccessioError';
    this.code = code ?? null;
    this.config = redactConfig(config ?? null);
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
    const accessioError = new AccessioError(error.message, code, config, request, response);
    accessioError.cause = error;
    accessioError.stack = error.stack;
    return accessioError;
  }
}

export default AccessioError;
