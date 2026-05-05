// Error reference table + final CTA.
function ErrorTable() {
  const rows = [
    ['ERR_BAD_REQUEST', '4xx status code', '4xx'],
    ['ERR_BAD_RESPONSE', '5xx status code', '5xx'],
    ['ERR_NETWORK', 'Network connectivity issues', '—'],
    ['ETIMEDOUT', 'Request exceeded timeout', '—'],
    ['ERR_CANCELED', 'Request was manually aborted', '—'],
    ['ERR_INVALID_URL', 'The provided URL is malformed', '—'],
    ['ERR_BAD_OPTION', 'Invalid configuration option', '—'],
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
        Error handling
      </div>
      <h2 className="t-h2" style={{ marginBottom: 32, maxWidth: 640 }}>
        Structured errors, every time.
      </h2>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--ink-900)' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '14px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-muted)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                Code
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '14px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-muted)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                Description
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '14px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-muted)',
                  borderBottom: '1px solid var(--border)',
                  width: 100,
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([code, desc, status], i) => (
              <tr
                key={code}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td
                  style={{
                    padding: '14px 20px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--ink-100)',
                    fontSize: 13,
                  }}
                >
                  {code}
                </td>
                <td style={{ padding: '14px 20px', color: 'var(--ink-300)', fontSize: 14 }}>
                  {desc}
                </td>
                <td
                  style={{
                    padding: '14px 20px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg-muted)',
                    fontSize: 13,
                  }}
                >
                  {status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--ink-900)' }}>
      <div
        className="footer-container"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true">
            <g
              fill="none"
              stroke="#8e98ad"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 38 C 14 28, 22 22, 32 22 C 42 22, 50 26, 52 32 L 56 30 L 52 36 C 50 44, 42 50, 32 50 C 22 50, 14 46, 14 38 Z" />
              <circle cx="44" cy="30" r="6" />
              <path d="M50 30 L 58 28 L 50 32 Z" fill="#8e98ad" />
            </g>
            <circle cx="45" cy="29" r="2" fill="#f59321" />
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
            accessio · MIT · built by{' '}
            <a className="t-link" href="https://github.com/salvatorecorvaglia">
              @salvatorecorvaglia
            </a>
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
            v1.0.0
          </span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { ErrorTable, Footer });
