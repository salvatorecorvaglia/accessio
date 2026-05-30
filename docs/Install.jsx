// Quick-start install block with package-manager tabs.
function Install() {
  const [tab, setTab] = React.useState('npm');
  const cmds = {
    npm: 'npm install accessio',
    pnpm: 'pnpm add accessio',
    yarn: 'yarn add accessio',
    bun: 'bun add accessio',
  };
  const sample = `import accessio from "accessio";

// Simple GET
const { data } = await accessio.get("/users");

// POST with retries + debug
const res = await accessio.post("/users",
  { name: "Ada", role: "engineer" },
  { retry: 3, debug: true }
);

console.log(\`Created user in \${res.duration}ms\`);`;

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '72px 32px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        className="responsive-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 56, alignItems: 'start' }}
      >
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 14 }}>
            Quick start
          </div>
          <h2 className="t-h2" style={{ marginBottom: 16 }}>
            One install. Promise-based.
          </h2>
          <p className="t-body" style={{ maxWidth: 420, marginBottom: 24 }}>
            Drop in as a replacement for <code className="t-code">axios</code>. Same shape, half the
            weight. Works in Node 18+ and every modern browser.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 14,
              padding: 4,
              background: 'var(--ink-800)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 'fit-content',
            }}
          >
            {Object.keys(cmds).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: tab === k ? 'var(--ink-700)' : 'transparent',
                  color: tab === k ? 'var(--ink-100)' : 'var(--fg-muted)',
                  border: '1px solid ' + (tab === k ? 'var(--border-strong)' : 'transparent'),
                  cursor: 'pointer',
                  transition: 'all var(--dur) var(--ease-out)',
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <CodeBlock language={tab}>{`$ ${cmds[tab]}`}</CodeBlock>
        </div>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 14 }}></div>
          <CodeBlock language="typescript">{sample}</CodeBlock>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Install });
