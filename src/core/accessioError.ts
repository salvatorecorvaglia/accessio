import ErrorCodes from '../constants/errorCodes';
import type { AccessioRequestConfig, AccessioResponse } from '../types';

function redactHeaders(headers: unknown, seen?: WeakSet<object>): unknown {
  if (!headers || typeof headers !== 'object') return headers;
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(headers as object)) return '[Circular]';
  visited.add(headers as object);

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    const value = (headers as Record<string, unknown>)[key];
    if (/^authorization$/i.test(key) || /^cookie$/i.test(key) || /^set-cookie$/i.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactHeaders(value, visited);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const SENSITIVE_BODY_KEY =
  /^(password|passwd|pwd|token|access_token|refresh_token|id_token|authorization|api[_-]?key|secret|client[_-]?secret|cookie|set[_-]?cookie|private[_-]?key|session)$/i;

export function redactBody(value: unknown, seen?: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;

  // Guard against binary formats, streams, buffers to prevent heavy serialization
  if (
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) ||
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  ) {
    return '[Binary/Stream Data]';
  }

  const visited = seen ?? new WeakSet<object>();
  if (visited.has(value as object)) return '[Circular]';
  visited.add(value as object);

  if (Array.isArray(value)) {
    if (value.length > 100) {
      const sliced = value.slice(0, 100).map((item) => redactBody(item, visited));
      sliced.push(`[... ${value.length - 100} more items truncated]`);
      return sliced;
    }
    return value.map((item) => redactBody(item, visited));
  }

  const out: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>);

  if (keys.length > 100) {
    let count = 0;
    for (const key of keys) {
      if (count >= 100) {
        out['...'] = `[Truncated: ${keys.length - 100} more keys]`;
        break;
      }
      const v = (value as Record<string, unknown>)[key];
      if (SENSITIVE_BODY_KEY.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactBody(v, visited);
      }
      count++;
    }
    return out;
  }

  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key];
    if (SENSITIVE_BODY_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactBody(v, visited);
    }
  }
  return out;
}

function redactParams(params: unknown, seen?: WeakSet<object>): unknown {
  if (!params || typeof params !== 'object') return params;
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(params as object)) return '[Circular]';
  visited.add(params as object);

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params as Record<string, unknown>)) {
    const value = (params as Record<string, unknown>)[key];
    if (SENSITIVE_BODY_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactParams(value, visited);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function redactURL(url: string | undefined): string | undefined {
  if (!url) return url;
  // Match inline credentials: http://user:pass@host
  let redacted = url.replace(/^([a-z][a-z\d+\-.]*:\/\/)([^/]+)@/i, (_match, protocol, userInfo) => {
    const parts = userInfo.split(':');
    if (parts.length > 1) {
      return `${protocol}${parts[0]}:[REDACTED]@`;
    }
    return `${protocol}[REDACTED]@`;
  });

  // Redact sensitive query parameters
  const qIndex = redacted.indexOf('?');
  if (qIndex !== -1) {
    const base = redacted.slice(0, qIndex);
    const query = redacted.slice(qIndex + 1);
    const hashIndex = query.indexOf('#');
    let search = query;
    let hash = '';
    if (hashIndex !== -1) {
      search = query.slice(0, hashIndex);
      hash = query.slice(hashIndex);
    }
    const parts = search.split('&');
    const redactedParts = parts.map((part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) return part;
      const key = part.slice(0, eqIndex);
      if (SENSITIVE_BODY_KEY.test(decodeURIComponent(key))) {
        return `${key}=[REDACTED]`;
      }
      return part;
    });
    redacted = base + '?' + redactedParts.join('&') + hash;
  }
  return redacted;
}

export function redactConfig(config: AccessioRequestConfig | null): AccessioRequestConfig | null {
  if (!config) return config;
  const clone = { ...config } as AccessioRequestConfig & { auth?: unknown };
  if ('auth' in clone) clone.auth = undefined;
  if (clone.headers) clone.headers = redactHeaders(clone.headers) as typeof clone.headers;
  if (clone.params) clone.params = redactParams(clone.params) as typeof clone.params;
  if (clone.url) clone.url = redactURL(clone.url);
  if (clone._builtUrl) clone._builtUrl = redactURL(clone._builtUrl);
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
  private _config: AccessioRequestConfig | null;
  private _redactedConfig: AccessioRequestConfig | null = null;
  readonly request: unknown;
  readonly response: AccessioResponse | null;
  readonly isAccessioError: true;
  cause?: Error;
  override name = 'AccessioError' as const;

  get config(): AccessioRequestConfig | null {
    if (this._redactedConfig === null && this._config !== null) {
      this._redactedConfig = redactConfig(this._config);
    }
    return this._redactedConfig;
  }

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
    this._config = config ?? null;
    this.request = request ?? null;
    this.response = response ?? null;
    this.isAccessioError = true;

    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, AccessioError);
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
