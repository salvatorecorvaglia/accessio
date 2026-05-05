// Shared UI primitives for the Accessio landing page.
// Loaded as type="text/babel". Exports primitives onto window so other JSX files can use them.

// --- Icon: tiny line-icon library (Lucide-style, inlined) ---
function Icon({ name, size = 18, stroke = 1.5, style }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style,
  };
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    github: (
      <>
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </>
    ),
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    refresh: (
      <>
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M21 3v6h-6" />
      </>
    ),
    shield: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
    code: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    package: (
      <>
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </>
    ),
    layers: (
      <>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </>
    ),
    gauge: (
      <>
        <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        <path d="m13.4 12.6 4.6-4.6" />
        <path d="M3 12a9 9 0 0 1 18 0" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    star: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
    type: (
      <>
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

// --- Button ---
function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  icon,
  trailingArrow,
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: size === 'lg' ? '12px 22px' : '10px 18px',
    borderRadius: 8,
    fontFamily: 'var(--font-sans)',
    fontSize: size === 'lg' ? 15 : 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all var(--dur) var(--ease-out)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--on-accent)' },
    secondary: {
      background: 'var(--ink-700)',
      color: 'var(--ink-100)',
      borderColor: 'var(--border)',
    },
    ghost: { background: 'transparent', color: 'var(--ink-100)' },
  };
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      href={href}
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
      className={`btn btn-${variant}`}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {trailingArrow ? (
        <span className="btn-arrow" style={{ transition: 'transform var(--dur) var(--ease-out)' }}>
          →
        </span>
      ) : null}
    </Tag>
  );
}

// --- Pill ---
function Pill({ tone = 'neutral', children, dot }) {
  const tones = {
    neutral: {
      background: 'var(--ink-700)',
      color: 'var(--ink-200)',
      border: '1px solid var(--border)',
    },
    amber: {
      background: 'rgba(245,147,33,0.12)',
      color: 'var(--amber-200)',
      border: '1px solid rgba(245,147,33,0.3)',
    },
    ok: {
      background: 'rgba(70,201,127,0.1)',
      color: 'var(--ok)',
      border: '1px solid rgba(70,201,127,0.3)',
    },
    info: {
      background: 'rgba(58,168,207,0.12)',
      color: 'var(--cyan-300)',
      border: '1px solid rgba(58,168,207,0.3)',
    },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        ...tones[tone],
      }}
    >
      {dot ? (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      ) : null}
      {children}
    </span>
  );
}

// --- CodeBlock with copy button ---
function CodeBlock({ children, language = 'ts', copyText }) {
  const [copied, setCopied] = React.useState(false);
  const text = copyText || (typeof children === 'string' ? children : '');
  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      style={{
        background: 'var(--ink-900)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--ink-800)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            {language}
          </span>
        </div>
        <button
          onClick={onCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: copied ? 'var(--ok)' : 'var(--ink-200)',
            cursor: 'pointer',
            transition: 'color var(--dur) var(--ease-out)',
          }}
        >
          {copied ? '✓ copied' : '⧉ copy'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '18px 20px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: 'var(--ink-100)',
          overflowX: 'auto',
        }}
      >
        <code dangerouslySetInnerHTML={{ __html: highlight(text) }} />
      </pre>
    </div>
  );
}

// Tiny syntax highlighter — keyword / string / comment / number / identifier
function highlight(src) {
  let s = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // comments
  s = s.replace(/(\/\/[^\n]*)/g, '<span style="color:var(--ink-400)">$1</span>');
  // strings
  s = s.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#46c97f">$1</span>');
  s = s.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span style="color:#46c97f">$1</span>');
  // keywords
  s = s.replace(
    /\b(const|let|var|async|await|function|return|import|from|export|new|if|else|true|false|null|undefined|interface|type|class|extends)\b/g,
    '<span style="color:#c084fc">$1</span>',
  );
  // booleans / numbers
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#ffb13b">$1</span>');
  // method calls .word(
  s = s.replace(/\.([a-zA-Z_]\w*)\(/g, '.<span style="color:#6cc8e8">$1</span>(');
  return s;
}

// Stash on window for sibling JSX files.
Object.assign(window, { Icon, Button, Pill, CodeBlock });
