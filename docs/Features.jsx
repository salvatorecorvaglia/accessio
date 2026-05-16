// 8-up feature grid.
function Features() {
  const items = [
    {
      icon: 'layers',
      title: 'Interceptors',
      desc: 'Transform requests and responses globally or per instance, sync or async.',
    },
    {
      icon: 'refresh',
      title: 'Automatic retries',
      desc: 'Network errors and 5xx responses retry with exponential backoff and jitter.',
    },
    {
      icon: 'gauge',
      title: 'Rate limiting',
      desc: 'Built-in concurrency control. Cap parallel requests across one client or many.',
    },
    {
      icon: 'code',
      title: 'Structured debug',
      desc: 'Beautiful console logs out of the box: arrows, status icons, timing, payload size.',
    },
    {
      icon: 'shield',
      title: 'Security hardened',
      desc: 'Built-in protection against prototype pollution and hardened config merging.',
    },
    {
      icon: 'clock',
      title: 'Timeout & Cancellation',
      desc: 'Native AbortController support for precise request timing and manual aborts.',
    },
    {
      icon: 'type',
      title: 'TypeScript-first',
      desc: 'Full type definitions, generics on responses, and structured error unions.',
    },
    {
      icon: 'globe',
      title: 'Isomorphic',
      desc: 'Same API in Node ≥ 18 and the browser. Built on the native fetch primitive.',
    },
  ];

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '72px 32px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div className="t-eyebrow" style={{ marginBottom: 14 }}>
        What's inside
      </div>
      <h2 className="t-h2" style={{ maxWidth: 640, marginBottom: 48 }}>
        Everything you'd hand-roll on top of{' '}
        <span
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-200)', fontSize: '0.85em' }}
        >
          fetch
        </span>{' '}
        — already done.
      </h2>
      <div
        className="feature-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 18,
        }}
      >
        {items.map((it) => (
          <div
            key={it.title}
            className="feature-card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '26px 24px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--dur) var(--ease-out)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--ink-700)',
                border: '1px solid var(--border)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              <Icon name={it.icon} size={18} />
            </div>
            <h3
              style={{
                margin: '0 0 6px',
                fontFamily: 'var(--font-sans)',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--ink-100)',
              }}
            >
              {it.title}
            </h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-300)' }}>
              {it.desc}
            </p>
          </div>
        ))}
      </div>
      <style>{`
        .feature-card:hover { border-color: var(--border-strong); background: var(--ink-700); }
      `}</style>
    </section>
  );
}

Object.assign(window, { Features });
