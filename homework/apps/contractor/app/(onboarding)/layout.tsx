export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px', marginTop: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem',
            }}
          >
            Homework
            <span style={{ color: 'var(--hw-blue)', marginLeft: '0.375rem' }}>
              Pro
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Let&apos;s set up your business
          </p>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
