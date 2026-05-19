// Three alternating prose + code panels: interceptors, retries, rate limiting.
function CodeShowcase() {
  const sections = [
    {
      eyebrow: 'Interceptors',
      title: 'Transform every request, before it leaves.',
      body: 'Attach handlers globally or per-instance — sync or async. Inject auth headers, log payloads, or bail out on 401 in one place.',
      code: `accessio.interceptors.request.use((config) => {
  config.headers["Authorization"] = \`Bearer \${getToken()}\`;
  return config;
});

accessio.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  }
);`,
    },
    {
      eyebrow: 'Retries',
      title: 'Backoff, jitter, and stop conditions — built in.',
      body: 'Retries happen automatically on network errors and 5xx responses. Configure attempts, base delay, custom predicates, and onRetry hooks.',
      code: `await accessio.get("/flaky-endpoint", {
  retry: 5,
  retryDelay: 1000,
  // 1s, 2s, 4s, 8s, 16s — ±25% jitter
  retryCondition: (err) => err.response?.status !== 404,
  onRetry: (attempt, err) => {
    console.log(\`retry #\${attempt} after \${err.code}\`);
  },
});`,
    },
    {
      eyebrow: 'Rate limiting',
      title: 'Cap concurrency. Save your API quota.',
      body: 'Create a limiter once, share it across instances. Pending requests queue up — no manual semaphores.',
      code: `import { createRateLimiter } from "accessio";

const limiter = createRateLimiter(5);

const api = accessio.create({
  baseURL: "https://api.example.com",
  rateLimiter: limiter,
});

// 200 requests, max 5 in flight at any time.
await Promise.all(
  ids.map((id) => api.get(\`/items/\${id}\`))
);`,
    },
    {
      eyebrow: 'Timeouts',
      title: 'Built-in cancellation via AbortController.',
      body: 'Set global or per-request timeouts. Pass your own AbortSignal to cancel requests manually when a user navigates away or a component unmounts.',
      code: `const controller = new AbortController();
    
await accessio.get("/long-task", {
  timeout: 5000,
  signal: controller.signal,
});

// Cancel anytime
controller.abort();`,
    },
    {
      eyebrow: 'Auto-pagination',
      title: 'Iterate over pages without the boilerplate.',
      body: 'Automatically follows "next" links in response payloads. Works with async generators for memory-efficient processing of large datasets.',
      code: `// Automatically follows response.next or links.next
for await (const user of accessio.autoPaginate("/users")) {
  console.log("Got user:", user.name);
  if (someCondition) break; // Stops fetching immediately
}`,
    },
    {
      eyebrow: 'Streaming',
      title: 'Handle SSE and NDJSON with async iterators.',
      body: 'Perfect for LLM responses, real-time logs, or large data exports. Parsed JSON objects are yielded as they arrive over the wire.',
      code: `const stream = accessio.stream("/ai/generate", {
  params: { prompt: "Hello world" }
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content || "");
}`,
    },
    {
      eyebrow: 'Caching & Dedupe',
      title: 'Store responses. Prevent duplicate requests.',
      body: 'Reduce database load and network overhead. Automatically caches GET responses in-memory with custom TTLs and deduplicates in-flight requests.',
      code: `const api = accessio.create({
  dedupe: true,            // Deduplicate matching in-flight GETs
  cache: true,             // Cache responses in memory
  cacheTTL: 5 * 60 * 1000, // TTL of 5 minutes (in ms)
});

// Only 1 network request is made, cached response is reused
const [res1, res2] = await Promise.all([
  api.get("/users/current"),
  api.get("/users/current"),
]);`,
    },
    {
      eyebrow: 'Lifecycle hooks',
      title: 'Hook into the request lifecycle.',
      body: 'Monitor and intercept requests, responses, and errors at specific lifecycle stages. Ideal for custom analytics, logging, or dynamic header injections.',
      code: `const api = accessio.create({
  hooks: {
    onBeforeRequest: async (config) => {
      console.log(\`Starting request to \${config.url}\`);
    },
    onRequestResponse: async (response) => {
      console.log(\`Request succeeded: \${response.status}\`);
    },
    onRequestError: async (error) => {
      console.error(\`Request failed: \${error.message}\`);
    },
  },
});`,
    },
    {
      eyebrow: 'Schema validation',
      title: 'Type-safe responses with schema parsing.',
      body: 'Ensure response bodies match your application types. Automatically validate and parse API payloads using Zod or custom schema parsers.',
      code: `import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// response.data is fully parsed and type-safe
const { data } = await accessio.get("/user/profile", {
  schema: UserSchema,
});`,
    },
  ];

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 72px' }}>
      {sections.map((s, i) => (
        <div
          key={s.eyebrow}
          className="responsive-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 56,
            alignItems: 'center',
            padding: '56px 0',
            borderTop: '1px solid var(--border)',
            direction: i % 2 === 1 ? 'rtl' : 'ltr',
          }}
        >
          <div style={{ direction: 'ltr' }}>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>
              {s.eyebrow}
            </div>
            <h3 className="t-h2" style={{ fontSize: 30, marginBottom: 14, maxWidth: 460 }}>
              {s.title}
            </h3>
            <p className="t-body" style={{ maxWidth: 440 }}>
              {s.body}
            </p>
          </div>
          <div style={{ direction: 'ltr' }}>
            <CodeBlock language="typescript">{s.code}</CodeBlock>
          </div>
        </div>
      ))}
    </section>
  );
}

Object.assign(window, { CodeShowcase });
