# Accessio 🎯

**Fast, flexible, zero-dependency modern HTTP client for JS/TS**

**Accessio** is a lightweight, modern HTTP client built on top of the native fetch API. It provides a familiar, Promise-based interface with advanced features like interceptors, automatic retries, rate limiting, and structured debug logging, all while maintaining zero external dependencies.

---

## Features ✨

- 📦 **Zero Dependencies** — Ultra-lightweight codebase leveraging native `fetch`.
- 🧩 **Dual-Module Support** — Shipping fully compatible ES Modules (ESM) and CommonJS (CJS) builds.
- 🔒 **Type-Safe** — Written from the ground up in TypeScript with exported first-class typings.
- 📡 **HTTP Shorthand Methods** — `get`, `post`, `put`, `delete`, `options`, `patch`, `head`.
- 📝 **Form Submissions** — Helper methods like `postForm`, `putForm`, and `patchForm` for simple `multipart/form-data` uploads.
- 🌊 **SSE & Stream Processing** — Stream server responses line-by-line using async generators (`stream`).
- 📃 **Auto-Pagination** — Effortless cursored/linked API pagination with `autoPaginate`.
- 🕸️ **GraphQL Support** — Sane GraphQL POST request shortcut (`gql`).
- ⚡ **Interceptors** — Both synchronous and asynchronous request/response hooks.
- 🔄 **Advanced Retries** — Automatic retries with customizable delay, backoff limits, and conditions (e.g., retrying on 429).
- 🚦 **Rate Limiting** — Custom concurrent and queued request rate-limiting with cancellation support.
- 👥 **Request Deduplication** — De-duplicates active identical inflight GET requests to optimize performance.
- 💾 **Response Caching** — Built-in Memory Cache with TTL and mutation protection (cloning) or plug in your own custom cache store.
- 🔍 **Schema Validation** — Seamless validation hooks using Zod, Valibot, or custom schemas.
- 📊 **Download Progress Tracking** — Real-time progress monitoring (`onDownloadProgress`) during response streaming.

---

## Installation 📦

Install Accessio using your preferred package manager:

```bash
# Using pnpm (recommended)
pnpm add accessio

# Using npm
npm install accessio

# Using yarn
yarn add accessio

# Using bun
bun add accessio
```

---

## Quick Start 🚀

### Basic Requests

```typescript
import accessio from 'accessio';

// Simple GET request
const response = await accessio.get('https://api.example.com/users/1');
console.log(response.data); // Automatically parsed JSON

// POST request with body
const createResponse = await accessio.post('https://api.example.com/users', {
  name: 'Salvatore Corvaglia',
  role: 'Developer'
});
```

### Custom Client Instances

Create instances with base configurations:

```typescript
import accessio from 'accessio';

const client = accessio.create({
  baseURL: 'https://api.example.com/v1',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

// Sends GET to https://api.example.com/v1/projects
const response = await client.get('/projects');
```

---

## Advanced Features 🛠️

### 1. Server-Sent Events & Streaming 🌊
Read streams line-by-line using `async generators`. Accessio handles SSE formats (`data: ...`) and returns JSON or strings automatically:

```typescript
// Stream completions from an LLM endpoint
for await (const chunk of accessio.stream('https://api.example.com/chat/stream')) {
  console.log(chunk); // Parsed JSON chunk or raw text line
}
```

### 2. Auto-Pagination 📃
Iterate through paginated APIs seamlessly. It automatically tracks `next` links or page tokens:

```typescript
// Automatically fetches next pages using standard link patterns
const pageGenerator = accessio.autoPaginate('https://api.example.com/items', {
  // Optional: customize page extraction mapping
  paginateItems: (data) => data.results, 
});

for await (const item of pageGenerator) {
  console.log('Paginated item:', item);
}
```

### 3. GraphQL 🕸️
Perform GraphQL queries with a dedicated wrapper:

```typescript
const query = `
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
    }
  }
`;

const response = await accessio.gql('https://api.example.com/graphql', query, { id: '123' });
console.log(response.data.user);
```

### 4. Caching 💾
Cache responses in memory to speed up repeated queries. It supports automated cloning so references don't mutate:

```typescript
const response = await accessio.get('https://api.example.com/config', {
  cache: true,      // Enable caching
  cacheTTL: 60000,   // TTL in milliseconds (1 minute)
});
```

You can also pass a custom `CacheProvider` implementation matching the `CacheProvider` interface:
```typescript
interface CacheProvider {
  get: (key: string) => Promise<any> | any;
  set: (key: string, value: any, ttl?: number) => Promise<void> | void;
  delete: (key: string) => Promise<void> | void;
  clear: () => Promise<void> | void;
}
```

### 5. Request Deduplication 👥
Prevent sending multiple identical concurrent requests (e.g. on dashboard load). In-flight requests for the same endpoint are collapsed into a single call:

```typescript
// Only one network request is made; both calls receive the same response
const [res1, res2] = await Promise.all([
  accessio.get('/profile', { dedupe: true }),
  accessio.get('/profile', { dedupe: true })
]);
```

### 6. Rate Limiting 🚦
Control concurrent requests to protect client/server throughput constraints:

```typescript
import accessio, { createRateLimiter } from 'accessio';

// Allow maximum 3 concurrent requests, max queue size of 10
const limiter = createRateLimiter(3, 10);

const client = accessio.create({
  rateLimiter: limiter
});
```

### 7. Interceptors ⚡
Add custom middleware hooks to transform requests or handle responses/errors globally:

```typescript
const client = accessio.create();

// Add request interceptor
client.interceptors.request.use(
  (config) => {
    config.headers = { ...config.headers, 'X-Custom-Header': 'Accessio' };
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor
client.interceptors.response.use(
  (response) => {
    console.log('Received response from:', response.config.url);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access globally
    }
    return Promise.reject(error);
  }
);
```

### 8. Schema Validation 🔍
Pass Zod or Valibot schemas to automatically validate and type responses:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const response = await accessio.get('https://api.example.com/users/1', {
  schema: UserSchema // Throws validation errors early if fields mismatch
});
```

### 9. Download Progress Tracking 📊
Monitor response payload download progress in real time using the `onDownloadProgress` callback:

```typescript
const response = await accessio.get('https://api.example.com/large-dataset.json', {
  onDownloadProgress: (progress) => {
    console.log(`Downloaded ${progress.loaded} of ${progress.total ?? 'unknown'} bytes (${progress.progress}%);
  }
});
```

---

## Configuration API ⚙️

Here is a list of popular config parameters available on `AccessioRequestConfig`:

| Option | Type | Default | Description |
|---|---|---|---|
| `baseURL` | `string` | `undefined` | Prefixed URL for requests. |
| `timeout` | `number` | `0` | Request timeout in milliseconds (0 means disabled). |
| `headers` | `object` | `{}` | Key-value pairs for HTTP request headers. |
| `responseType`| `'json' \| 'text' \| 'blob' \| 'arraybuffer' \| 'stream'` | `'json'` | Data type expected back from the server. |
| `retry` | `number` | `0` | Number of times to retry failed requests. |
| `retryDelay` | `number` | `1000` | Delay between retries in milliseconds. |
| `maxRetryDelay` | `number` | `30000` | Cap on exponential backoff delays. |
| `retryOn429` | `boolean` | `false` | Whether to automatically retry on HTTP 429 status code. |
| `dedupe` | `boolean` | `false` | Enable collapsing of identical concurrent GET requests. |
| `cache` | `boolean \| CacheProvider` | `false` | Enable in-memory caching of responses. |
| `cacheTTL` | `number` | `undefined` | Duration (ms) response should remain in cache. |
| `allowedProtocols` | `string[]` | `undefined` | List of permitted URL protocols (e.g., `['https:']`). |
| `maxContentLength` | `number` | `undefined` | Max response size in bytes permitted (throws error early). |
| `maxRedirects` | `number` | `undefined` | Maximum number of HTTP redirects to follow automatically. |
| `onDownloadProgress` | `(progress: DownloadProgressEvent) => void` | `undefined` | Callback invoked with real-time download progress details. |
| `schema` | `SchemaValidator` | `undefined` | Schema to run `.parse()` or `.parseAsync()` against. |

---

## Error Handling 🛡️

Errors thrown by Accessio are instances of `AccessioError` which carry metadata about the request and response, with automatic redaction of sensitive parameters (such as `api_key` or `password`) and headers (such as `authorization`, `proxy-authorization`, `x-api-key`, and `api-key`):

```typescript
import accessio from 'accessio';

try {
  await accessio.get('/invalid-endpoint');
} catch (error) {
  if (accessio.isAccessioError(error)) {
    console.error('Status Code:', error.response?.status);
    console.error('Error Code:', error.code);
    console.error('Request URL:', error.config?.url); // Redacted query params
    console.error('Request Headers:', error.config?.headers); // Redacted sensitive headers
  }
}
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📜 Changelog

Detailed release history and version changes can be found in [CHANGELOG.md](CHANGELOG.md).

## 🔐 Security

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md).

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

**Author**: [Salvatore Corvaglia](https://github.com/salvatorecorvaglia)