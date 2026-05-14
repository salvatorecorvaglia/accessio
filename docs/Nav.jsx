// Sticky top nav with logo lockup + GitHub button.
function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7,9,13,0.7)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'border-color var(--dur) var(--ease-out)',
      }}
    >
      <div
        className="nav-container"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <a
          href="#"
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        >
          <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
            <g
              fill="none"
              stroke="#e8ebf2"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 38 C 14 28, 22 22, 32 22 C 42 22, 50 26, 52 32 L 56 30 L 52 36 C 50 44, 42 50, 32 50 C 22 50, 14 46, 14 38 Z" />
              <circle cx="44" cy="30" r="6" />
              <path d="M50 30 L 58 28 L 50 32 Z" fill="#e8ebf2" />
              <path d="M22 34 Q 28 28, 36 32 Q 32 38, 24 38 Z" />
              <path d="M14 36 L 8 34 L 14 40" />
              <path d="M28 50 L 28 56" />
              <path d="M36 50 L 36 56" />
            </g>
            <circle cx="45" cy="29" r="2" fill="#f59321" />
          </svg>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: '-0.04em',
              color: 'var(--ink-100)',
            }}
          >
            accessio
          </span>
        </a>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--accent)',
              padding: '2px 7px',
              borderRadius: 999,
              border: '1px solid rgba(245,147,33,0.3)',
              background: 'rgba(245,147,33,0.08)',
              letterSpacing: '0.06em',
            }}
          >
            v{window.ACCESSIO_CONFIG.version}
          </span>
          <Button
            variant="secondary"
            size="md"
            icon="github"
            href="https://github.com/salvatorecorvaglia/accessio"
          >
            Star on GitHub
          </Button>
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { Nav });
