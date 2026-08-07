'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

// Nav is one entry per role that holds a step in a process. Roles with no steps
// have no board, by construction.
const NAV = [
  { href: '/parts', label: 'Parts Coordinator' },
  { href: '/warehouse', label: 'Warehouse' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: session, status } = useSession();

  if (status === 'loading') return <div style={{ padding: 32, font: '15px system-ui' }}>Loading…</div>;
  if (!session) {
    return (
      <div style={{ padding: 48, font: '15px/1.6 system-ui', maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, marginTop: 0 }}>Rigor</h1>
        <p style={{ color: '#666' }}>Sign in with your Christmas Air account.</p>
        <button onClick={() => signIn('google')} style={{ font: 'inherit', fontWeight: 650, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#1b6b45', color: '#fff', cursor: 'pointer' }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', font: '15px system-ui' }}>
      <aside style={{ flex: '0 0 208px', borderRight: '1px solid var(--line,#dde3dd)', padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ padding: '0 10px 14px', fontWeight: 800, letterSpacing: '-.02em' }}>
          Rigor
          <div style={{ fontSize: 11.5, fontWeight: 500, color: '#8b958e', letterSpacing: 0 }}>Christmas Air</div>
        </div>
        {NAV.map(n => {
          const on = path === n.href;
          return (
            <Link key={n.href} href={n.href}
              style={{ padding: '8px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 14,
                fontWeight: on ? 700 : 500, background: on ? 'rgba(27,107,69,.12)' : 'transparent',
                color: on ? '#1b6b45' : 'inherit' }}>
              {n.label}
            </Link>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '0 10px', fontSize: 11.5, color: '#8b958e' }}>
          {session.user?.email}
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
