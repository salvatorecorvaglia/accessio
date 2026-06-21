# Accessio 🎯

**Fast, flexible HTTP client — simple, modular, and dependency-free.**

Accessio is a lightweight, modern HTTP client built on top of the native fetch API. It provides a familiar, Promise-based interface with advanced features like interceptors, automatic retries, rate limiting, and structured debug logging, all while maintaining zero external dependencies.

---

## ⚡ Key Features

- **Zero Runtime Dependencies**: Keep your bundle size minimal and avoid supply chain vulnerabilities.
- **📦 Dual ESM/CJS Support**: Native support for both ES Modules (`import`) and CommonJS (`require`) environments, compiled correctly for modern Node.js and browsers.
- **Axios-Compatible API**: Direct drop-in replacement with `.get()`, `.post()`, `.request()`, and custom instances via `.create()`.
- **🛡️ Built-in Security & Auto-Redaction**: Prevents accidental leakage of secrets in error logs. Automatically redacts:
  - `Authorization`, `Cookie`, and `Set-Cookie` headers.
  - Sensitive request/response parameters (e.g., `api_key`, `token`, `password`, `secret`).
  - Inline credentials inside URLs.
- **⏳ Concurrency Rate Limiter**: Built-in queue-based rate limiter to throttle concurrent requests, complete with immediate queue ejection on `AbortSignal` cancellation.
- **🔁 Jittered Exponential Backoff Retry**: Automatic retries for network failures or `5xx` status codes. Fully respects the HTTP 429 `Retry-After` header and supports customizable retry conditions and callbacks.
- **🌊 SSE & Newline JSON Streaming**: Native asynchronous generator-based parsing for Server-Sent Events (SSE) and newline-delimited JSON streams.
- **📂 Auto-Pagination**: Seamlessly yields paginated items from APIs using page links (e.g., `next` or `links.next`).
- **🧪 Type-safe Schema Validation**: Validate API response payloads at runtime using Zod, ArkType, or any validation library with a `.parse()` or `.parseAsync()` method.
- **📦 Request Deduplication**: Automatically coalesces concurrent duplicate GET requests to avoid redundant network traffic.
- **💾 Memory Caching**: In-memory caching out-of-the-box with custom TTL, or easily swap in a custom storage provider (e.g., Redis, LocalStorage).
- **🔗 Synchronous & Asynchronous Interceptors**: Hook into the request/response pipeline to dynamically inject headers, handle global errors, or log metrics.
- **⚓ Lifecycle Hooks**: Granular callbacks (`onBeforeRequest`, `onRequestResponse`, `onRequestError`) for custom instrumentation.
- **FormData Serialization**: Automatically converts flat or nested JS objects to `FormData` for multipart submissions.

---

## 📦 Installation

```bash
npm install accessio
```

---

## 🚀 Quick Start

### Basic Requests

```typescript
import accessio from 'accessio';

// Simple GET request
const response = await accessio.get('https://api.example.com/users/123');
console.log(response.data); // Automatically parsed JSON response

// POST request with body
const postResponse = await accessio.post('https://api.example.com/users', {
  name: 'Jane Doe',
  role: 'Developer',
});
```

### Custom Instances

```typescript
import accessio from 'accessio';

// Create a configured instance
const api = accessio.create({
  baseURL: 'https://api.example.com/v1',
  headers: {
    'X-Client-Name': 'AccessioClient',
  },
  timeout: 5000, // 5-second timeout
});

// Use instance methods
const { data } = await api.get('/users');
```

---

## 🛠️ Advanced Features

### 🛡️ Auto-Redaction (Zero-leak Logs)

Accessio is built with security first. If a request fails, sensitive credentials in request/response properties are redacted automatically before being attached to the `AccessioError`.

```typescript
try {
  await accessio.get('https://admin:secret_password@api.example.com/users', {
    params: { api_key: 'super_secret_token_123' },
    headers: { Authorization: 'Bearer token_xyz' },
  });
} catch (error) {
  if (accessio.isAccessioError(error)) {
    console.error(error.toJSON());
    /*
      Outputs:
      {
        "name": "AccessioError",
        "message": "Request failed with status code 401",
        "code": "ERR_BAD_REQUEST",
        "status": 401,
        "config": {
          "url": "https://admin:[REDACTED]@api.example.com/users",
          "params": {
            "api_key": "[REDACTED]"
          },
          "headers": {
            "authorization": "[REDACTED]"
          }
        }
      }
    */
  }
}
```

### 🔁 Automatic Retries & Backoff

Automatically retry failed requests using exponential backoff with randomized jitter to prevent thundering herds.

```typescript
const response = await accessio.get('/flaky-endpoint', {
  retry: 3, // Max retry attempts
  retryDelay: 1000, // Initial delay in ms (doubles each attempt)
  maxRetryDelay: 10000, // Maximum delay cap
  retryOn429: true, // Respect Retry-After header for HTTP 429 responses
  onRetry: (attempt, error, config) => {
    console.warn(`Retry attempt #${attempt} due to: ${error.message}`);
  },
});
```

### ⏳ Concurrency Rate Limiting

Throttle outbound requests using a queue-based rate limiter. This is especially useful for third-party APIs with tight request limits.

```typescript
import accessio, { createRateLimiter } from 'accessio';

// Allow a maximum of 2 requests in parallel
const rateLimiter = createRateLimiter(2);

const api = accessio.create({ rateLimiter });

// These will run with a max concurrency of 2, queueing the rest
const requests = [1, 2, 3, 4, 5].map((id) => api.get(`/users/${id}`));
const responses = await Promise.all(requests);
```

### 🌊 SSE & Newline JSON Streaming

Accessio leverages asynchronous generators to handle incoming response streams dynamically (works with Server-Sent Events or line-by-line JSON streams).

```typescript
// Iterating through an AI completion SSE stream
for await (const chunk of api.stream('/ai/complete')) {
  console.log(chunk); // Parsed JSON chunk, e.g., { text: "hello" }
}
```

### 📂 Auto-Pagination

Avoid boilerplate code for pagination. Accessio can auto-follow `next` and `links.next` properties automatically:

```typescript
// Automatically fetches subsequent pages until next link is null
for await (const item of api.autoPaginate('/users?page=1')) {
  console.log(item.name); // Yields individual items from each page's items array
}
```

### 🧪 Runtime Schema Validation

Validate your API payloads at runtime using your favorite validation library (e.g., Zod, ArkType, Superstruct).

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const response = await api.get('/users/123', {
  schema: UserSchema, // Throws AccessioError (ERR_BAD_RESPONSE) if validation fails
});

const user = response.data; // Fully typed as { id: string; name: string; email: string }
```

### 📦 Request Deduplication & Caching

Optimize application performance by preventing duplicate queries and utilizing caching.

```typescript
const api = accessio.create({
  dedupe: true, // Merge concurrent requests targeting the same endpoint
  cache: true, // Enable in-memory cache
  cacheTTL: 60000, // Cache responses for 60 seconds
});

// Executes exactly 1 network call, resolves both promises
const [res1, res2] = await Promise.all([api.get('/heavy-report'), api.get('/heavy-report')]);
```

### 🔗 Interceptors & Hooks

Modify requests and responses at runtime, or listen to client lifecycles:

```typescript
const api = accessio.create();

// Add Request Interceptor
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers['X-Request-Timestamp'] = Date.now().toString();
  return config;
});

// Add Response Interceptor
api.interceptors.response.use(
  (response) => {
    // Modify output data
    return response;
  },
  (error) => {
    // Handle global errors (e.g. token refresh)
    return Promise.reject(error);
  },
);
```

---

## ⚙️ Configuration Options

Here is the complete list of config parameters available in `AccessioRequestConfig`:

| Option             | Type                                                      | Default               | Description                                                                    |
| :----------------- | :-------------------------------------------------------- | :-------------------- | :----------------------------------------------------------------------------- |
| `baseURL`          | `string`                                                  | `undefined`           | Prepended to relative URLs.                                                    |
| `method`           | `string`                                                  | `'get'`               | HTTP request method (e.g., `'get'`, `'post'`).                                 |
| `headers`          | `Record`                                                  | `{}`                  | Key-value mapping of custom headers.                                           |
| `params`           | `Record`                                                  | `undefined`           | Query parameters appended to the URL.                                          |
| `data`             | `any`                                                     | `undefined`           | The payload to send in the request body.                                       |
| `timeout`          | `number`                                                  | `0` (disabled)        | Request timeout in milliseconds.                                               |
| `responseType`     | `'json' \| 'text' \| 'blob' \| 'arraybuffer' \| 'stream'` | `'json'`              | Expected format of the response data.                                          |
| `retry`            | `number`                                                  | `0`                   | Number of times to retry failed requests.                                      |
| `retryDelay`       | `number`                                                  | `1000`                | Initial delay for exponential backoff (ms).                                    |
| `retryOn429`       | `boolean`                                                 | `false`               | Automatically retry on 429 using the `Retry-After` header.                     |
| `rateLimiter`      | `RateLimiter`                                             | `undefined`           | A rate limiter instance to enqueue requests.                                   |
| `dedupe`           | `boolean`                                                 | `false`               | Coalesce concurrent duplicate GET requests.                                    |
| `cache`            | `boolean \| CacheProvider`                                | `false`               | Enable caching using memory or custom provider.                                |
| `cacheTTL`         | `number`                                                  | `undefined`           | TTL for cached responses in ms.                                                |
| `schema`           | `SchemaValidator`                                         | `undefined`           | Zod/schema parser to validate response body.                                   |
| `hooks`            | `AccessioHooks`                                           | `undefined`           | Lifecycle callbacks: `onBeforeRequest`, `onRequestResponse`, `onRequestError`. |
| `allowedProtocols` | `string[] \| null`                                        | `['http:', 'https:']` | Protocols allowed for requesting. Set to `null` to disable check.              |

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🔐 Security

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md).

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

**Author**: [Salvatore Corvaglia](https://github.com/salvatorecorvaglia)
