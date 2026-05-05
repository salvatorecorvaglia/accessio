// Animated terminal/debug log specimen — the signature hero motif.
function Terminal({ lines, autoplay = true, loop = true }) {
  const [n, setN] = React.useState(autoplay ? 0 : lines.length);
  React.useEffect(() => {
    if (!autoplay) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > lines.length) {
        if (loop) {
          setTimeout(() => {
            i = 0;
            setN(0);
          }, 1800);
        } else {
          clearInterval(id);
          return;
        }
      }
      setN(i);
    }, 520);
    return () => clearInterval(id);
  }, [autoplay, loop, lines.length]);

  return (
    <div
      style={{
        background: '#07090d',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--ink-900)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f06868' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f5b13b' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#46c97f' }} />
        <span
          style={{
            marginLeft: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-muted)',
          }}
        >
          accessio · live debug
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--accent)',
          }}
        >
          ● connected
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '18px 20px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.85,
          color: 'var(--ink-100)',
          minHeight: 220,
        }}
      >
        {lines.slice(0, n).map((ln, i) => (
          <div
            key={i}
            style={{
              opacity: 0,
              animation: 'fadein 240ms var(--ease-out) forwards',
            }}
            dangerouslySetInnerHTML={{ __html: ln }}
          />
        ))}
        {n < lines.length ? (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 14,
              background: 'var(--accent)',
              verticalAlign: 'middle',
              animation: 'blink 1s steps(2) infinite',
            }}
          />
        ) : null}
      </pre>
      <style>{`
        @keyframes fadein { to { opacity: 1; } }
        @keyframes blink  { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

Object.assign(window, { Terminal });
