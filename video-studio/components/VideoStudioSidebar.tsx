'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const navLinks = [
  { href: '/', label: 'My Videos', icon: 'home' },
  { href: '/create', label: 'Create Video', icon: 'plus' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    plus: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
    arrow: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
  };
  return icons[type] || null;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoStudioSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: 'var(--christmas-cream)' }}>
                Video Studio
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Branded team videos
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? ''
                    : 'hover:bg-white/5'
                }`}
                style={{
                  color: isActive(link.href)
                    ? 'var(--christmas-cream)'
                    : 'var(--text-secondary)',
                  backgroundColor: isActive(link.href)
                    ? 'rgba(93, 138, 102, 0.15)'
                    : undefined,
                }}
              >
                <NavIcon type={link.icon} />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Link
              href="https://portal.christmasair.com"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <NavIcon type="arrow" />
              Back to Portal
            </Link>

            {session?.user && (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                    {session.user.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {session.user.email}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="ml-2 p-1.5 rounded hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
