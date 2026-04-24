# accessio 🎯

**Fast, flexible HTTP client for Node.js and browsers — simple, modular, and dependency-free** — lightweight, modern, zero dependencies.

---

## ✨ Features

- 🚀 **Promise-based** — works seamlessly with `async`/`await`
- 🌐 **Isomorphic** — runs in both browser and Node.js (≥ 18)
- 🪶 **Zero dependencies** — lightweight, built on native `fetch`
- 🔄 **Interceptors** — transform requests and responses globally
- ⚙️ **Configurable instances** — create multiple API clients with custom defaults
- 🛡️ **Error handling** — structured `AccessioError` with status, config, and response
- 📦 **Dual format** — supports both ESM and CommonJS
- 📐 **TypeScript support** — full type definitions included
- ⏱️ **Timeout support** — built-in request timeout via `AbortController`
- 🔧 **Transform pipelines** — customize request/response data transformation
- ♻️ **Automatic Retries** — built-in retry logic with exponential backoff and jitter
- ⏱️ **Duration tracking** — every response includes a `duration` field in milliseconds
- 🚥 **Rate Limiter** — limit concurrent requests with acquire/release/destroy lifecycle
- 🐞 **Debug Mode** — structured console logging for outgoing requests and responses
- 🎯 **Familiar API** — intuitive, developer-friendly interface

---

## 📦 Installation

accessio is available on both the official npm registry (unscoped) and GitHub Packages (scoped).

```bash
# Recommended: Standard npm registry
npm install accessio

# Alternative: GitHub Packages
npm install @salvatorecorvaglia/accessio
```

---

## 🚀 Quick Start

```typescript
import accessio from "accessio";

// GET request
const response = await accessio.get("https://api.example.com/users");
console.log(response.data);

// POST request with JSON body
const newUser = await accessio.post("https://api.example.com/users", {
  name: "John Doe",
  email: "john@example.com",
});
console.log(newUser.data);
```

---

## 📖 API Reference

### Request Methods

```javascript
accessio(config)
accessio(url, config?)

accessio.request(config)
accessio.get(url, config?)
accessio.delete(url, config?)
accessio.head(url, config?)
accessio.options(url, config?)
accessio.post(url, data?, config?)
accessio.put(url, data?, config?)
accessio.patch(url, data?, config?)
accessio.postForm(url, data?, config?)
accessio.putForm(url, data?, config?)
accessio.patchForm(url, data?, config?)
accessio.getUri(config)
```

### Configuration

```javascript
{
  // URL path (optional if baseURL is set)
  url: '/users',

  // HTTP method (default: 'get')
  method: 'get',

  // Base URL prepended to `url` unless `url` is absolute
  baseURL: 'https://api.example.com',

  // Request headers
  headers: {
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value'
  },

  // URL query parameters
  params: { page: 1, limit: 10 },

  // Custom params serializer
  paramsSerializer: (params) => Qs.stringify(params),

  // Request body (for POST, PUT, PATCH)
  data: { name: 'John' },

  // Timeout in milliseconds (0 = no timeout)
  timeout: 5000,

  // Expected response type: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream'
  responseType: 'json',

  // Include credentials in cross-site requests
  withCredentials: false,

  // Basic auth (sets Authorization header automatically)
  auth: { username: 'user', password: 'secret' },

  // Transform functions for request/response data
  transformRequest: [(data, headers) => { /* ... */ return data; }],
  transformResponse: [(data) => { /* ... */ return data; }],

  // Automatic retry strategy
  retry: 3,                // Max retry attempts (default: 0)
  retryDelay: 1000,        // Base delay in ms, doubles on each attempt (default: 1000)
  retryCondition: (error) => true,  // Custom retry predicate
  onRetry: (attempt, error, config) => {},  // Called before each retry

  // Debug logging
  debug: true,             // Enable request/response debug logger

  // Rate limiting
  rateLimiter: limiter,    // Rate limiter instance for concurrency control

  // Determine which status codes resolve/reject the promise
  validateStatus: (status) => status >= 200 && status < 300,

  // AbortSignal for request cancellation
  signal: controller.signal
}
```

### Response Object

```javascript
{
  data: {},              // Parsed response body
  status: 200,           // HTTP status code
  statusText: 'OK',      // HTTP status message
  headers: {},           // Response headers (lowercase keys)
  config: {},            // Request configuration used
  request: {},           // Underlying fetch Response object
  duration: 142          // Request duration in milliseconds
}
```

---

## 🔧 Creating Instances

```typescript
import accessio from "accessio";

const api = accessio.create({
  baseURL: "https://api.example.com",
  timeout: 10000,
  headers: {
    Authorization: "Bearer my-token",
  },
});

// All requests will use the instance config
const users = await api.get("/users");
const posts = await api.get("/posts", { params: { limit: 5 } });
```

---

## 🔄 Interceptors

```typescript
// Request interceptor — runs before every request
accessio.interceptors.request.use(
  (config) => {
    config.headers["Authorization"] = `Bearer ${getToken()}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — runs after every response
accessio.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 globally
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

// Conditional interceptor — runs only when the predicate returns true
accessio.interceptors.request.use(
  (config) => {
    /* ... */ return config;
  },
  null,
  { runWhen: (config) => config.method === "post" },
);

// Remove a single interceptor
const id = accessio.interceptors.request.use(/* ... */);
accessio.interceptors.request.eject(id);

// Remove all interceptors
accessio.interceptors.request.clear();
```

**Execution order:**

- Request interceptors run in **reverse** order (last added → first executed)
- Response interceptors run in **normal** order (first added → first executed)

---

## 🛡️ Error Handling

```typescript
try {
  await accessio.get("/might-fail");
} catch (error) {
  if (accessio.isAccessioError(error)) {
    if (error.response) {
      console.log(error.response.status); // 404, 500, etc.
      console.log(error.response.data); // Response body
    } else if (error.code === "ERR_NETWORK") {
      console.log("Network error — no response received");
    } else if (error.code === "ETIMEDOUT") {
      console.log("Request timed out");
    } else if (accessio.isCancel(error)) {
      console.log("Request was cancelled");
    }

    console.log(error.config); // Request config
    console.log(error.message); // Error message
    console.log(error.toJSON()); // Serializable summary
  }
}
```

### Error Codes

| Code                        | Description                             |
| --------------------------- | --------------------------------------- |
| `ERR_BAD_REQUEST`           | 4xx status code                         |
| `ERR_BAD_RESPONSE`          | 5xx status code                         |
| `ERR_NETWORK`               | Network error (no response received)    |
| `ETIMEDOUT`                 | Request timed out                       |
| `ECONNABORTED`              | Request was aborted                     |
| `ERR_CANCELED`              | Request was cancelled via `AbortSignal` |
| `ERR_BAD_OPTION`            | Invalid or missing configuration option |
| `ERR_BAD_OPTION_VALUE`      | Invalid configuration option value      |
| `ERR_INVALID_URL`           | The provided URL is invalid             |
| `ERR_FR_TOO_MANY_REDIRECTS` | Too many redirects                      |
| `ERR_NOT_SUPPORT`           | Feature not supported in environment    |

---

## 🔀 Concurrent Requests

```javascript
const [users, posts] = await accessio.all([
  accessio.get("/users"),
  accessio.get("/posts"),
]);

// Or with the spread helper (deprecated — use modern spread syntax instead)
accessio.all([accessio.get("/users"), accessio.get("/posts")]).then(
  accessio.spread((users, posts) => {
    console.log(users.data, posts.data);
  }),
);
```

---

## ❌ Cancellation

```javascript
const controller = new AbortController();

accessio
  .get("/slow-endpoint", {
    signal: controller.signal,
  })
  .catch((error) => {
    if (accessio.isCancel(error)) {
      console.log("Request cancelled:", error.message);
    }
  });

// Cancel the request
controller.abort();
```

---

## 🔧 Transform Request / Response

```javascript
const api = accessio.create({
  transformRequest: [
    (data, headers) => {
      // Add a timestamp to every outgoing body
      if (data && typeof data === "object") {
        data.timestamp = Date.now();
      }
      return JSON.stringify(data);
    },
  ],
  transformResponse: [
    (data) => {
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch {}
      }
      return data;
    },
    (data) => {
      // Unwrap a { data: ... } envelope
      return data?.data ?? data;
    },
  ],
});
```

---

## ♻️ Advanced Features

### Automatic Retry

accessio supports configurable retries with exponential backoff and ±25% jitter to prevent thundering herd.

```javascript
const response = await accessio.get("/flaky-api", {
  retry: 3, // Retry up to 3 times
  retryDelay: 1000, // Base delay — doubles on each attempt: 1s, 2s, 4s

  // Optional: custom condition (default: network errors + 5xx)
  retryCondition: (error) => error.response?.status === 503,

  // Optional: callback before each retry
  onRetry: (attempt, error, config) => {
    console.log(`Retry attempt #${attempt} after: ${error.message}`);
  },
});
```

The default `retryCondition` retries on:

- `ERR_NETWORK` — no response received
- `ETIMEDOUT` — request timed out
- 5xx server errors
- Does **not** retry on `ERR_CANCELED` or 4xx client errors

### Rate Limiting

Control the maximum number of concurrent in-flight requests.

#### Option 1: Built-in config integration (recommended)

```javascript
import accessio, { createRateLimiter } from "accessio";

const limiter = createRateLimiter(5); // max 5 concurrent requests

// Pass the limiter directly in the request config
const response = await accessio.get("/api/data", { rateLimiter: limiter });

// Or set it as an instance default
const api = accessio.create({ rateLimiter: limiter });
const users = await api.get("/users");
```

#### Option 2: Manual acquire / release

```javascript
import { createRateLimiter } from "accessio";

const limiter = createRateLimiter(5);

await limiter.acquire();
try {
  const res = await accessio.get("/api/data");
} finally {
  limiter.release();
}

// Inspect state
console.log(limiter.active); // Currently running requests
console.log(limiter.pending); // Requests waiting in queue

// Cleanup on navigation / component unmount — rejects all queued promises
limiter.destroy();
console.log(limiter.destroyed); // true
```

### Debug Logging

Enable `debug: true` on an instance or a single request to get structured console output.

```javascript
const api = accessio.create({ debug: true });

// 🐦‍⬛ [accessio] → GET https://api.example.com/users
//    Params: {"page":1}
//    Timeout: 5000ms
// 🐦‍⬛ [accessio] ← ✅ 200 OK (142ms)
//    Size: ~3.2 KB

// Or enable per-request only
await accessio.get("/debug-this", { debug: true });
```

---

## 📥 Imports

### ESM (recommended)

```typescript
import accessio from "accessio";
import {
  createRateLimiter,
  AccessioError,
  mergeConfig,
  buildURL,
  logRequest,
  logResponse,
  logError,
} from "accessio";
```

### CommonJS

```typescript
const accessio = require("accessio");
const { createRateLimiter } = require("accessio");
```

### Sub-path imports

```javascript
// Import only what you need
import { createRateLimiter } from "accessio/helpers/rateLimiter";
import { logRequest, logResponse, logError } from "accessio/helpers/debug";
import { buildURL } from "accessio/core/buildURL";
import { mergeConfig } from "accessio/core/mergeConfig";
import { dispatchRequest } from "accessio/core/request";
import { retryRequest } from "accessio/core/retry";
import { parseHeaders } from "accessio/helpers/parseHeaders";
import { settle } from "accessio/helpers/settle";
import { transformData } from "accessio/helpers/transformData";
```

---

## 📝 Author

**Salvatore Corvaglia**

- GitHub: [@salvatorecorvaglia](https://github.com/salvatorecorvaglia)
