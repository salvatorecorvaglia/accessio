# Accessio 🎯

**Fast, flexible HTTP client — simple, modular, and dependency-free.**

Accessio is a lightweight, modern HTTP client built on top of the native fetch API. It provides a familiar, Promise-based interface with advanced features like interceptors, automatic retries, rate limiting, and structured debug logging, all while maintaining zero external dependencies.

---

## ✨ Features

- 🚀 **Promise-based** — works seamlessly with `async`/`await`
- 🌐 **Isomorphic** — runs in both browser and Node.js (≥ 18)
- 🪶 **Zero dependencies** — ultra-lightweight, built on native `fetch`
- 🔄 **Interceptors** — transform requests and responses globally or per instance
- ⚙️ **Configurable instances** — create multiple API clients with custom defaults
- 🛡️ **Robust Error handling** — structured `AccessioError` with status, config, and response
- 📦 **Dual format** — full support for both ESM and CommonJS
- 📐 **TypeScript first** — written in TS with comprehensive type definitions
- ⏱️ **Timeout & Cancellation** — built-in support via `AbortController` and `signal`
- 🔧 **Transform pipelines** — flexible request/response data transformation
- ♻️ **Automatic Retries** — smart retry logic with exponential backoff and jitter
- 🚥 **Rate Limiter** — built-in concurrency control for high-throughput applications
- 🐞 **Debug Mode** — structured, beautiful console logging for easy development
- ⏱️ **Duration Tracking** — every response includes precise timing metadata
- 🧬 **GraphQL Support** — built-in `gql` method for easy querying
- 📡 **SSE Streaming** — async iterators for Server-Sent Events via `stream`
- 📚 **Auto-Pagination** — seamlessly iterate through paginated APIs via `autoPaginate`
- 🛡️ **Schema Validation** — validate responses automatically using Zod or custom schemas
- 🗂️ **Caching & Deduplication** — prevent redundant requests and cache responses
- 🪝 **Lifecycle Hooks** — simple hooks for request/response/error events

---

## 📦 Installation

```bash
# Using npm
npm install accessio

# Using yarn
yarn add accessio

# Using pnpm
pnpm add accessio
```

---

## 🚀 Quick Start

```typescript
import accessio from 'accessio';

// Simple GET request
const { data } = await accessio.get('https://api.example.com/users');

// POST request with JSON body
const response = await accessio.post('https://api.example.com/users', {
  name: 'John Doe',
  role: 'Developer',
});

console.log(`User created in ${response.duration}ms`);
```

---

## 📖 API Reference

### Request Methods

| Method                                     | Description                              |
| :----------------------------------------- | :--------------------------------------- |
| `accessio(config)`                         | Generic request using config object      |
| `accessio.get(url, config?)`               | GET request                              |
| `accessio.post(url, data?, config?)`       | POST request                             |
| `accessio.put(url, data?, config?)`        | PUT request                              |
| `accessio.patch(url, data?, config?)`      | PATCH request                            |
| `accessio.delete(url, config?)`            | DELETE request                           |
| `accessio.head(url, config?)`              | HEAD request                             |
| `accessio.options(url, config?)`           | OPTIONS request                          |
| `accessio.postForm(url, data?, config?)`   | POST request with `multipart/form-data`  |
| `accessio.putForm(url, data?, config?)`    | PUT request with `multipart/form-data`   |
| `accessio.patchForm(url, data?, config?)`  | PATCH request with `multipart/form-data` |
| `accessio.stream(url, config?)`            | Server-Sent Events (SSE) streaming       |
| `accessio.autoPaginate(url, config?)`      | Async iterator for paginated endpoints   |
| `accessio.gql(url, query, vars?, config?)` | GraphQL query/mutation wrapper           |

### Configuration Options

```typescript
{
  baseURL: 'https://api.example.com', // Base URL for all requests
  url: '/users',                     // Relative or absolute URL
  method: 'get',                     // HTTP method (default: get)
  headers: { 'X-Custom': 'val' },    // Custom headers
  params: { id: 123 },               // URL query parameters
  paramsSerializer: (params) => {},  // Custom query parameter serializer
  data: { name: 'John' },            // Request body (JSON/FormData/etc)
  timeout: 5000,                     // Timeout in ms (default: 0)
  responseType: 'json',              // Expected response: 'json', 'text', 'blob', 'stream'
  auth: { username: '', password: '' }, // Basic auth credentials
  retry: 3,                          // Max retry attempts
  retryDelay: 1000,                  // Base delay for exponential backoff
  maxRetryDelay: 30000,              // Max delay between retries in ms (default: 30000)
  retryOn429: true,                  // Automatically retry on rate limits
  allowedProtocols: ['http:', 'https:'], // Allowed URL protocols (default: ['http:', 'https:'], set to null to disable checks)
  maxContentLength: 10 * 1024 * 1024, // Max allowed content length in bytes
  transformRequest: [(data, headers) => data],  // Transform request data/headers before sending
  transformResponse: [(data, headers) => data], // Transform response data/headers before resolving
  debug: true,                       // Enable structured logging
  rateLimiter: limiter,              // Concurrency limiter instance
  validateStatus: (s) => s < 400,    // Resolve/reject predicate
  signal: abortController.signal,    // Custom AbortSignal
  dedupe: true,                      // Prevent duplicate in-flight requests
  cache: true,                       // Cache responses (boolean or CacheProvider)
  cacheTTL: 60000,                   // Cache time-to-live in ms
  schema: z.object({...}),           // Schema validator (e.g., Zod)
  fetch: customFetch,                // Custom fetch implementation
  onDownloadProgress: ({ loaded, total }) => {}, // Track download progress (supported on length-based stream responses)
  hooks: {                           // Lifecycle hooks
    onBeforeRequest: (config) => {},
    onRequestResponse: (response) => {},
    onRequestError: (error) => {}
  }
}
```

---

## ♻️ Advanced Usage

### Interceptors

Interceptors allow you to transform requests or responses before they are handled by `then` or `catch`.

```typescript
// Add a request interceptor
accessio.interceptors.request.use((config) => {
  config.headers['Authorization'] = `Bearer ${storage.getToken()}`;
  return config;
});

// Add a response interceptor
accessio.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) logout();
    return Promise.reject(error);
  },
);
```

### Error Handling

Accessio provides a structured error object with specific codes to help you handle failures gracefully.

| Code               | Description                   |
| :----------------- | :---------------------------- |
| `ERR_BAD_REQUEST`  | 4xx status code               |
| `ERR_BAD_RESPONSE` | 5xx status code               |
| `ERR_NETWORK`      | Network connectivity issues   |
| `ETIMEDOUT`        | Request exceeded timeout      |
| `ERR_CANCELED`     | Request was manually aborted  |
| `ERR_INVALID_URL`  | The provided URL is malformed |
| `ERR_BAD_OPTION`   | Invalid configuration option  |

### Automatic Retries

Accessio includes a powerful retry mechanism that handles network errors and 5xx responses automatically. You can configure the number of retries, base delay, and cap the max delay with `maxRetryDelay`.

```typescript
const response = await accessio.get('/flaky-endpoint', {
  retry: 5,
  retryDelay: 1000, // Base delay: 1000ms
  maxRetryDelay: 10000, // Cap delay between attempts at 10 seconds (default: 30000ms)
  retryOn429: true, // Automatically retry on 429 status code using Retry-After header or backoff
  onRetry: (attempt, error) => console.log(`Retry #${attempt}...`),
});
```

### Rate Limiting

Limit concurrent requests globally or per-instance to prevent overloading APIs. You can configure the maximum number of concurrent requests and the maximum queue capacity. Aborting a rate-limited request will immediately eject it from the queue and reclaim capacity.

```typescript
import { createRateLimiter } from 'accessio';

// Max 5 concurrent requests, and max queue size of 50
const limiter = createRateLimiter(5, 50);
const api = accessio.create({ rateLimiter: limiter });

const controller = new AbortController();

// If the queue is full (exceeds 50), new requests reject immediately.
// You can pass an AbortSignal to eject pending requests:
api
  .get('/heavy-endpoint', { signal: controller.signal })
  .catch((err) => console.log('Aborted request ejected from queue.'));

// Cancel/eject the queued request immediately
controller.abort();
```

### Debug Mode

Get beautiful, structured logs in your console by enabling `debug: true`.

```typescript
// 🐦‍⬛ [accessio] → GET https://api.example.com/users
//    Params: {"page":1}
//    Timeout: 5000ms
// 🐦‍⬛ [accessio] ← ✅ 200 OK (142ms)
//    Size: ~3.2 KB
```

### Caching & Deduplication

Prevent duplicate requests and cache responses to improve performance. Caching can be enabled with a simple boolean or customized using a custom `CacheProvider` implementation.

```typescript
import { type CacheProvider } from 'accessio';

// Custom cache provider (e.g. LocalStorage, Redis, custom store)
const myCacheProvider: CacheProvider = {
  get: (key) => {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },
  set: (key, val, ttl) => localStorage.setItem(key, JSON.stringify(val)),
  delete: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
};

const api = accessio.create({
  dedupe: true, // Prevents duplicate concurrent in-flight requests
  cache: myCacheProvider, // Custom cache provider (or true for default in-memory cache)
  cacheTTL: 5 * 60 * 1000, // Cache TTL in ms (5 minutes)
});
```

### Schema Validation

Automatically parse and validate responses using libraries like Zod.

```typescript
import { z } from 'zod';

const userSchema = z.object({ id: z.number(), name: z.string() });

const response = await accessio.get('/user/1', { schema: userSchema });
// response.data is strictly typed and validated against userSchema
```

### Server-Sent Events (SSE)

Easily consume SSE streams using async iterators.

```typescript
for await (const chunk of accessio.stream('/stream')) {
  console.log(chunk); // Parsed JSON or string data from SSE
}
```

### Auto-Pagination

Iterate through paginated endpoints effortlessly.

```typescript
for await (const user of accessio.autoPaginate('/users')) {
  console.log(user); // Automatically fetches the next page when needed
}
```

### GraphQL

Send GraphQL queries and mutations with ease.

```typescript
const query = `
  query GetUser($id: ID!) {
    user(id: $id) { name, email }
  }
`;

const response = await accessio.gql('/graphql', query, { id: '1' });
```

### Lifecycle Hooks

Use hooks for simple global or request-specific event handling.

```typescript
accessio.create({
  hooks: {
    onBeforeRequest: (config) => console.log('Starting request...'),
    onRequestResponse: (response) => console.log('Request succeeded!'),
    onRequestError: (error) => console.error('Request failed!'),
  },
});
```

---

## 🛠️ Developer Guide

### Local Setup

```bash
git clone https://github.com/salvatorecorvaglia/accessio.git
cd accessio
npm install
```

### Available Scripts

- `npm run build`: Generate CommonJS bundles
- `npm run test`: Run the full test suite with Vitest
- `npm run test:coverage`: Run tests with coverage report
- `npm run test:browser`: Run tests in browser environment
- `npm run lint`: Check for code style issues
- `npm run format`: Automatically format the codebase with Prettier
- `npm run typecheck`: Validate TypeScript types

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🔐 Security

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md).

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

**Author**: [Salvatore Corvaglia](https://github.com/salvatorecorvaglia)
