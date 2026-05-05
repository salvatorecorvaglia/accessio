// Hero — headline, lead, primary/secondary CTAs, animated terminal.
function Hero() {
  const lines = [
    `<span style="color:var(--fg-muted)">🐦‍⬛ [Accessio]</span> <span style="color:var(--accent)">→</span> GET https://api.example.com/users`,
    `   <span style="color:var(--fg-muted)">Params:</span> {"page":1,"limit":20}`,
    `   <span style="color:var(--fg-muted)">Timeout:</span> 5000ms · <span style="color:var(--fg-muted)">Retry:</span> 3x`,
    `<span style="color:var(--fg-muted)">🐦‍⬛ [Accessio]</span> <span style="color:var(--accent)">←</span> <span style="color:var(--ok)">✅ 200 OK</span> (142ms)`,
    `   <span style="color:var(--fg-muted)">Size:</span> ~3.2 KB`,
    `<span style="color:var(--fg-muted)">🐦‍⬛ [Accessio]</span> <span style="color:var(--accent)">→</span> POST https://api.example.com/users`,
    `<span style="color:var(--fg-muted)">🐦‍⬛ [Accessio]</span> <span style="color:var(--accent)">←</span> <span style="color:var(--err)">❌ ERROR</span>: 503 Service Unavailable`,
    `   <span style="color:var(--fg-muted)">Code:</span> ERR_BAD_RESPONSE · <span style="color:var(--warn)">retrying in 1.2s</span>`,
    `<span style="color:var(--fg-muted)">🐦‍⬛ [Accessio]</span> <span style="color:var(--accent)">←</span> <span style="color:var(--ok)">✅ 201 Created</span> (218ms · attempt 2)`,
  ];

  return (
    <section
      className="hero-grid"
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '88px 32px 56px',
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
        gap: 56,
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* dotted grid bg */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div className="hero-content" style={{ position: 'relative' }}>
        <div className="t-eyebrow" style={{ marginBottom: 24, textAlign: 'center' }}>
          zero dependencies, native fetch
        </div>
        <h1
          className="t-h1"
          style={{
            fontSize: 60,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            maxWidth: '100%',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          Native{' '}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--amber-200)',
            }}
          >
            fetch,
          </span>
          <br />
          dressed up.
        </h1>
        <p
          className="t-lead"
          style={{ marginTop: 22, maxWidth: 480, margin: '22px auto 0', textAlign: 'center' }}
        >
          A fast, flexible HTTP client for Node and browsers — with interceptors, structured
          retries, rate limiting, and a debug log you'll actually read.
        </p>
        <div
          className="hero-stats"
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 24,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            ['0', 'dependencies'],
            ['4.2 KB', 'gzipped'],
            ['≥18', 'Node version'],
            ['100%', 'TypeScript'],
          ].map(([n, l]) => (
            <div key={l}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  color: 'var(--ink-100)',
                  letterSpacing: '-0.02em',
                }}
              >
                {n}
              </div>
              <div className="t-meta" style={{ marginTop: 2 }}>
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <Terminal lines={lines} />
        <div
          style={{
            position: 'absolute',
            top: -32,
            right: 16,
            display: 'flex',
            gap: 6,
          }}
        >
          <Pill tone="amber" dot>
            retry: 3
          </Pill>
          <Pill tone="info" dot>
            debug: true
          </Pill>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Hero });
