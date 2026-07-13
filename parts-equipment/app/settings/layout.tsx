'use client';
import { usePathname, useRouter } from 'next/navigation';
import { usePEPermissions } from '@/hooks/usePEPermissions';

// Registry of settings sections. Add a new setting = new folder under
// app/settings/<slug>/page.tsx + one entry here.
const SECTIONS = [
  { href: '/settings/install-teams', label: 'Install Teams' },
  { href: '/settings/suppliers', label: 'Suppliers' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canManage, isLoading } = usePEPermissions();

  if (isLoading) return null;

  if (!canManage) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Settings</h1>
        <p style={{ color: 'var(--muted)', marginTop: 12 }}>You don&apos;t have permission to manage settings.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Manage options and configuration used across the app.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Sub-nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180, flexShrink: 0 }}>
          {SECTIONS.map(s => {
            const active = pathname === s.href || pathname?.startsWith(s.href + '/');
            return (
              <button
                key={s.href}
                onClick={() => router.push(s.href)}
                style={{
                  textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--radius-sm, 6px)',
                  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 500,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--muted)',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div style={{ flex: 1, minWidth: 280 }}>{children}</div>
      </div>
    </main>
  );
}
