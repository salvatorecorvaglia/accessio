import type InterceptorManager from './interceptors/interceptorManager';

export type Method = 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch';

export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';

export interface AuthConfig {
  username: string;
  password: string;
}

export type ParamsSerializer = (params: Record<string, unknown>) => string;

export type TransformFunction = (
  data: unknown,
  headers: Record<string, string | string[]>,
) => unknown | Promise<unknown>;

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

export interface AccessioHooks {
  onBeforeRequest?: (config: AccessioRequestConfig) => void | Promise<void>;
  onRequestResponse?: (response: AccessioResponse) => void | Promise<void>;
  onRequestError?: (error: AccessioError) => void | Promise<void>;
}

export interface CacheProvider {
  get: (key: string) => Promise<any> | any;
  set: (key: string, value: any, ttl?: number) => Promise<void> | void;
  delete: (key: string) => Promise<void> | void;
  clear: () => Promise<void> | void;
}

export interface SchemaValidator<T = any> {
  parse(data: unknown): T;
  parseAsync?(data: unknown): Promise<T>;
}

export interface AccessioRequestConfig {
  url?: string;
  baseURL?: string;
  method?: Method | string;
  params?: Record<string, unknown>;
  paramsSerializer?: ParamsSerializer;
  data?: unknown;
  headers?: Record<string, string | string[]> | Record<string, Record<string, string | string[]>>;
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
  maxContentLength?: number;
  allowedProtocols?: string[] | null;
  dispatcher?: unknown;
  agent?: unknown;
  dedupe?: boolean;
  cache?: boolean | CacheProvider;
  cacheTTL?: number;
  cacheKeySerializer?: (
    config: AccessioRequestConfig,
    fullURL: string,
    headers: Record<string, string | string[]>,
  ) => string;
  onDownloadProgress?: (progressEvent: { loaded: number; total: number }) => void;
  hooks?: AccessioHooks;
  schema?: SchemaValidator;
  fetch?: typeof fetch;
  retryOn429?: boolean;
  maxRetryDelay?: number;
}

export interface AccessioResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
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

export interface RateLimiter {
  acquire: (signal?: AbortSignal) => Promise<void>;
  release: () => void;
  destroy: () => void;
  pending: number;
  active: number;
  destroyed: boolean;
}
