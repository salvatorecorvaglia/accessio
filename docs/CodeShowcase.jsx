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
