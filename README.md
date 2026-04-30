# Accessio 🎯

[![npm version](https://img.shields.io/npm/v/accessio.svg?style=flat-square&color=007acc)](https://www.npmjs.com/package/accessio)
[![license](https://img.shields.io/npm/l/accessio.svg?style=flat-square&color=41ad51)](https://github.com/salvatorecorvaglia/accessio/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/accessio?style=flat-square&color=6a4cf5)](https://bundlephobia.com/package/accessio)
[![typescript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Fast, flexible HTTP client for Node.js and browsers — simple, modular, and dependency-free.**

`accessio` is a lightweight, modern HTTP client built on top of the native `fetch` API. It provides a familiar, Promise-based interface with advanced features like interceptors, automatic retries, rate limiting, and structured debug logging, all while maintaining **zero external dependencies**.

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
import accessio from "accessio";

// Simple GET request
const { data } = await accessio.get("https://api.example.com/users");

// POST request with JSON body
const response = await accessio.post("https://api.example.com/users", {
  name: "John Doe",
  role: "Developer",
});

console.log(`User created in ${response.duration}ms`);
```

---

## 📖 API Reference

### Request Methods

| Method                                   | Description                             |
| :--------------------------------------- | :-------------------------------------- |
| `accessio(config)`                       | Generic request using config object     |
| `accessio.get(url, config?)`             | GET request                             |
| `accessio.post(url, data?, config?)`     | POST request                            |
| `accessio.put(url, data?, config?)`      | PUT request                             |
| `accessio.patch(url, data?, config?)`    | PATCH request                           |
| `accessio.delete(url, config?)`          | DELETE request                          |
| `accessio.head(url, config?)`            | HEAD request                            |
| `accessio.options(url, config?)`         | OPTIONS request                         |
| `accessio.postForm(url, data?, config?)` | POST request with `multipart/form-data` |

### Configuration Options

```typescript
{
  baseURL: 'https://api.example.com', // Base URL for all requests
  url: '/users',                     // Relative or absolute URL
  method: 'get',                     // HTTP method (default: get)
  headers: { 'X-Custom': 'val' },    // Custom headers
  params: { id: 123 },               // URL query parameters
  data: { name: 'John' },            // Request body (JSON/FormData/etc)
  timeout: 5000,                     // Timeout in ms (default: 0)
  responseType: 'json',              // Expected response: 'json', 'text', 'blob', 'stream'
  auth: { username: '', password: '' }, // Basic auth credentials
  retry: 3,                          // Max retry attempts
  retryDelay: 1000,                  // Base delay for exponential backoff
  debug: true,                       // Enable structured logging
  rateLimiter: limiter,              // Concurrency limiter instance
  validateStatus: (s) => s < 400,    // Resolve/reject predicate
  signal: abortController.signal,    // Custom AbortSignal
}
```

---

## ♻️ Advanced Usage

### Interceptors

Interceptors allow you to transform requests or responses before they are handled by `then` or `catch`.

```typescript
// Add a request interceptor
accessio.interceptors.request.use((config) => {
  config.headers["Authorization"] = `Bearer ${storage.getToken()}`;
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

`accessio` provides a structured error object with specific codes to help you handle failures gracefully.

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

`accessio` includes a powerful retry mechanism that handles network errors and 5xx responses automatically.

```typescript
const response = await accessio.get("/flaky-endpoint", {
  retry: 5,
  retryDelay: 1000, // Delays: 1s, 2s, 4s, 8s, 16s (+/- random jitter)
  onRetry: (attempt, error) => console.log(`Retry #${attempt}...`),
});
```

### Rate Limiting

Limit concurrent requests globally or per-instance to prevent overloading APIs.

```typescript
import { createRateLimiter } from "accessio";

const limiter = createRateLimiter(5); // Max 5 concurrent requests
const api = accessio.create({ rateLimiter: limiter });

// Requests will wait in queue if limit is reached
const results = await Promise.all([
  api.get("/req-1"),
  api.get("/req-2"),
  // ...
]);
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

---

## 🛠️ Developer Guide

### Local Setup

```bash
git clone https://github.com/salvatorecorvaglia/accessio.git
cd accessio
npm install
```

### Available Scripts

- `npm run build`: Generate ESM and CommonJS bundles
- `npm run test`: Run the full test suite with Vitest
- `npm run lint`: Check for code style issues
- `npm run typecheck`: Validate TypeScript types

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## 🔐 Security

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md) for responsible disclosure instructions.

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

## 👤 Author

**Salvatore Corvaglia**

- GitHub: [@salvatorecorvaglia](https://github.com/salvatorecorvaglia)
