/**
 * Accessio HTTP Client — TypeScript Type Definitions
 */

/**
 * Avoids ambiguous intersection of Record<string, string> & { common?, get?, ... }
 * which TypeScript accepts but can confuse type consumers.
 */
export type AccessioHeaders = {
  common?: Record<string, string>;
  get?: Record<string, string>;
  post?: Record<string, string>;
  put?: Record<string, string>;
  patch?: Record<string, string>;
  delete?: Record<string, string>;
  head?: Record<string, string>;
  options?: Record<string, string>;
  /** Any additional custom headers */
  [key: string]: string | number | boolean | Record<string, string> | undefined;
};

export interface AccessioRequestConfig {
  /** Request URL (path or full URL) */
  url?: string;

  /** HTTP method (default: 'get') */
  method?:
    | "get"
    | "post"
    | "put"
    | "patch"
    | "delete"
    | "head"
    | "options"
    | string;

  /** Base URL prepended to `url` unless `url` is absolute */
  baseURL?: string;

  /** Request headers */
  headers?: AccessioHeaders;

  /** URL query parameters */
  params?: Record<string, any>;

  /** Custom params serializer function */
  paramsSerializer?: (params: Record<string, any>) => string;

  /** Request body data */
  data?: any;

  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;

  /** Include credentials in cross-site requests */
  withCredentials?: boolean;

  /** Expected response data type */
  responseType?: "json" | "text" | "blob" | "arraybuffer" | "stream";

  /** Transform functions applied to request data */
  transformRequest?: Array<
    (data: any, headers?: Record<string, string>) => any
  >;

  /** Transform functions applied to response data */
  transformResponse?: Array<
    (data: any, headers?: Record<string, string>) => any
  >;

  /** Function to determine if a status code should resolve or reject */
  validateStatus?: (status: number) => boolean;

  /** AbortSignal for request cancellation */
  signal?: AbortSignal;

  /** Basic auth credentials */
  auth?: {
    username: string;
    password: string;
  };

  // ── Retry options ──────────────────────────────────

  /** Maximum number of retry attempts (0 = no retries, default: 0) */
  retry?: number;

  /** Base delay in milliseconds for retry backoff (default: 1000) */
  retryDelay?: number;

  /** Custom condition to decide whether to retry a failed request */
  retryCondition?: (error: AccessioError) => boolean;

  /** Callback invoked before each retry attempt */
  onRetry?: (
    attempt: number,
    error: AccessioError,
    config: AccessioRequestConfig,
  ) => void;

  // ── Debug ──────────────────────────────────────────

  /** Enable debug logging for this request */
  debug?: boolean;

  // ── Rate Limiting ──────────────────────────────────

  /** Rate limiter instance to control concurrent requests */
  rateLimiter?: RateLimiter;

  /** Allow any additional custom properties */
  [key: string]: any;
}

export interface AccessioResponse<T = any> {
  /** Response data (parsed) */
  data: T;

  /** HTTP status code */
  status: number;

  /** HTTP status text */
  statusText: string;

  /** Response headers (lowercased keys) */
  headers: Record<string, string>;

  /** The config used for this request */
  config: AccessioRequestConfig;

  /** The underlying request object */
  request: any;

  /** Request duration in milliseconds */
  duration: number;
}

// ── Class type definitions ────────────────────────────────────

export interface AccessioClass {
  new (instanceConfig?: AccessioRequestConfig): {
    defaults: AccessioRequestConfig;
    interceptors: {
      request: InterceptorManager<AccessioRequestConfig>;
      response: InterceptorManager<AccessioResponse>;
    };
    request<T = any>(config: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    request<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    get<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    delete<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    head<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    options<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    postForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    putForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    patchForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
    getUri(config: AccessioRequestConfig): string;
  };
}

export interface InterceptorManagerClass {
  new <V>(): InterceptorManager<V>;
}

export interface AccessioError<T = any> extends Error {
  /** Error name (always 'AccessioError') */
  name: "AccessioError";

  /** Error message */
  message: string;

  /** Error code (e.g. 'ECONNABORTED', 'ERR_NETWORK') */
  code: string | null;

  /** The config used for this request */
  config: AccessioRequestConfig | null;

  /** The underlying request object */
  request: any | null;

  /** The response object (if available) */
  response: AccessioResponse<T> | null;

  /** Accessio error flag */
  isAccessioError: boolean;

  /** Original error that caused this AccessioError (set by AccessioError.from()) */
  cause?: Error;

  /** JSON representation */
  toJSON(): object;
}

export interface AccessioErrorConstructor {
  new (
    message: string,
    code?: string,
    config?: AccessioRequestConfig,
    request?: any,
    response?: AccessioResponse,
  ): AccessioError;

  /** Create an AccessioError from an existing Error */
  from(
    error: Error,
    code?: string,
    config?: AccessioRequestConfig,
    request?: any,
    response?: AccessioResponse,
  ): AccessioError;

  // Error code constants
  ERR_BAD_OPTION_VALUE: string;
  ERR_BAD_OPTION: string;
  ECONNABORTED: string;
  ETIMEDOUT: string;
  ERR_NETWORK: string;
  ERR_FR_TOO_MANY_REDIRECTS: string;
  ERR_BAD_RESPONSE: string;
  ERR_BAD_REQUEST: string;
  ERR_CANCELED: string;
  ERR_NOT_SUPPORT: string;
  ERR_INVALID_URL: string;
}

export interface InterceptorManager<V> {
  /**
   * Register a new interceptor.
   * @returns Interceptor ID for eject()
   */
  use(
    onFulfilled?: ((value: V) => V | Promise<V>) | null,
    onRejected?: ((error: any) => V | Promise<V>) | null,
    options?: {
      synchronous?: boolean;
      runWhen?: (config: AccessioRequestConfig) => boolean;
    },
  ): number;

  /** Remove an interceptor by its ID */
  eject(id: number): void;

  /** Remove all interceptors */
  clear(): void;

  /** Number of active (non-ejected) interceptors */
  readonly size: number;
}

/** Rate limiter instance returned by createRateLimiter() */
export interface RateLimiter {
  /** Acquire a slot. Resolves immediately if available, otherwise queues. */
  acquire(): Promise<void>;

  /** Release a slot. Starts the next queued request if any. */
  release(): void;

  /**
   * Destroy the limiter — rejects all pending queued promises immediately.
   * Any subsequent acquire() calls will also reject.
   * Useful for cleanup on SPA navigation or component unmount.
   */
  destroy(): void;

  /** Number of requests waiting in the queue */
  readonly pending: number;

  /** Number of currently active requests */
  readonly active: number;

  /** Whether the limiter has been destroyed */
  readonly destroyed: boolean;
}

export interface AccessioInstance {
  /** Execute a request with a full config object */
  (config: AccessioRequestConfig): Promise<AccessioResponse>;

  /** Execute a request with URL + optional config */
  (url: string, config?: AccessioRequestConfig): Promise<AccessioResponse>;

  /** Instance defaults (mutable) */
  defaults: AccessioRequestConfig;

  /** Request and response interceptors */
  interceptors: {
    request: InterceptorManager<AccessioRequestConfig>;
    response: InterceptorManager<AccessioResponse>;
  };

  /** Core request method */
  request<T = any>(config: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  request<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** GET request */
  get<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** DELETE request */
  delete<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** HEAD request */
  head<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** OPTIONS request */
  options<T = any>(
    url: string,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** POST request */
  post<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** PUT request */
  put<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** PATCH request */
  patch<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** POST with multipart/form-data */
  postForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** PUT with multipart/form-data */
  putForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** PATCH with multipart/form-data */
  patchForm<T = any>(
    url: string,
    data?: any,
    config?: AccessioRequestConfig,
  ): Promise<AccessioResponse<T>>;

  /** Get the built URL for a given config */
  getUri(config: AccessioRequestConfig): string;

  /** Create a new Accessio instance with custom defaults */
  create(instanceConfig?: AccessioRequestConfig): AccessioInstance;

  /** Execute multiple concurrent requests */
  all<T>(values: Array<T | Promise<T>>): Promise<T[]>;

  /** Spread array of responses to individual callback arguments */
  spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;

  /** Check if an error is a cancellation error */
  isCancel(value: any): boolean;

  /** Check if a value is a AccessioError */
  isAccessioError(value: any): boolean;

  /** AccessioError class */
  AccessioError: AccessioErrorConstructor;

  /** Accessio class */
  Accessio: AccessioClass;

  /** InterceptorManager class */
  InterceptorManager: InterceptorManagerClass;

  /** Create a rate limiter for concurrent request control */
  createRateLimiter(maxConcurrent?: number): RateLimiter;

  /** Merge two config objects */
  mergeConfig(
    config1: AccessioRequestConfig,
    config2?: AccessioRequestConfig,
  ): AccessioRequestConfig;

  /** Build a URL from parts */
  buildURL(
    url: string,
    baseURL?: string,
    params?: Record<string, any>,
    paramsSerializer?: (params: Record<string, any>) => string,
  ): string;
}

/** Default Accessio instance */
declare const accessio: AccessioInstance;
export default accessio;

// ── Named exports ─────────────────────────────────────────────
// Note: These are re-exported for convenience. The actual implementations
// are in src/, but TypeScript resolves these through package.json exports.

export interface Accessio {
  defaults: AccessioRequestConfig;
  interceptors: {
    request: InterceptorManager<AccessioRequestConfig>;
    response: InterceptorManager<AccessioResponse>;
  };
  request<T = any>(config: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  request<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  get<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  delete<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  head<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  options<T = any>(url: string, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  post<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  put<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  postForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  putForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  patchForm<T = any>(url: string, data?: any, config?: AccessioRequestConfig): Promise<AccessioResponse<T>>;
  getUri(config: AccessioRequestConfig): string;
}

export declare const Accessio: {
  new (instanceConfig?: AccessioRequestConfig): Accessio;
};

export const AccessioError: AccessioErrorConstructor;
export const mergeConfig: (config1: AccessioRequestConfig, config2?: AccessioRequestConfig) => AccessioRequestConfig;
export const buildURL: (url: string, baseURL?: string, params?: Record<string, any>, paramsSerializer?: (params: Record<string, any>) => string) => string;
export const InterceptorManager: InterceptorManagerClass;
export const createRateLimiter: (maxConcurrent?: number) => RateLimiter;

// ── Debug helper exports ────────────────────────────────────

export function logRequest(config: AccessioRequestConfig, fullUrl: string): void;
export function logResponse(response: AccessioResponse): void;
export function logError(error: Error, config?: AccessioRequestConfig): void;
