export type Method =
  | 'get'
  | 'delete'
  | 'head'
  | 'options'
  | 'post'
  | 'put'
  | 'patch';

export type ResponseType =
  | 'json'
  | 'text'
  | 'blob'
  | 'arraybuffer'
  | 'stream';

export interface AuthConfig {
  username: string;
  password: string;
}

export type ParamsSerializer = (params: Record<string, unknown>) => string;

export type TransformFunction = (
  data: unknown,
  headers: Record<string, string>,
) => unknown;

export type RetryConditionFunction = (error: AccessioError) => boolean;

export type OnRetryFunction = (
  attempt: number,
  error: AccessioError,
  config: AccessioRequestConfig,
) => void;

export type RunWhenFunction = (config: AccessioRequestConfig) => boolean;

export interface InterceptorOptions {
  synchronous?: boolean;
  runWhen?: RunWhenFunction;
}

export interface InterceptorHandler {
  fulfilled: TransformFunction | null;
  rejected: ((error: unknown) => unknown) | null;
  synchronous: boolean;
  runWhen: RunWhenFunction | null;
}

export interface Interceptors {
  request: InterceptorManager;
  response: InterceptorManager;
}

export interface AccessioRequestConfig {
  url?: string;
  baseURL?: string;
  method?: Method | string;
  params?: Record<string, unknown>;
  paramsSerializer?: ParamsSerializer;
  data?: unknown;
  headers?: Record<string, string> | Record<string, Record<string, string>>;
  auth?: AuthConfig;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  transformRequest?: TransformFunction | TransformFunction[];
  transformResponse?: TransformFunction | TransformFunction[];
  validateStatus?: ((status: number) => boolean) | null;
  retry?: number;
  retryDelay?: number;
  retryCondition?: RetryConditionFunction;
  onRetry?: OnRetryFunction;
  signal?: AbortSignal;
  debug?: boolean;
  rateLimiter?: RateLimiter;
  _builtUrl?: string;
}

export interface AccessioResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AccessioRequestConfig;
  request: Response;
  duration: number;
}

export interface AccessioError extends Error {
  name: 'AccessioError';
  code: string | null;
  config: AccessioRequestConfig | null;
  request: unknown;
  response: AccessioResponse | null;
  isAccessioError: true;
  cause?: Error;
  toJSON(): Record<string, unknown>;
}

export class InterceptorManager {
  handlers: Array<InterceptorHandler | null>;
  private _activeCount: number;

  constructor() {
    this.handlers = [];
    this._activeCount = 0;
  }

  use(
    fulfilled: TransformFunction,
    rejected?: (error: unknown) => unknown,
    options: InterceptorOptions = {},
  ): number {
    this.handlers.push({
      fulfilled: fulfilled || null,
      rejected: rejected || null,
      synchronous: options.synchronous || false,
      runWhen: options.runWhen || null,
    });

    this._activeCount++;
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
      this._activeCount--;
    }
  }

  clear(): void {
    this.handlers = [];
    this._activeCount = 0;
  }

  forEach(fn: (handler: InterceptorHandler) => void): void {
    for (const handler of this.handlers) {
      if (handler !== null) {
        fn(handler);
      }
    }
  }

  get size(): number {
    return this._activeCount;
  }
}

export interface RateLimiter {
  acquire: () => Promise<void>;
  release: () => void;
  destroy: () => void;
  pending: number;
  active: number;
  destroyed: boolean;
}
