'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/trackers', label: 'Trackers', icon: 'tracker' },
  { href: '/templates', label: 'Templates', icon: 'template' },
];

const managementLinks = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    tracker: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    template: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    arrow: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
    logout: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  };

  return icons[type] || icons.home;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Logo Section */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/dashboard" className="flex items-center gap-3" onClick={handleLinkClick}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>
                Christmas Air
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Job Tracker
              </div>
            </div>
          </Link>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Main Section */}
          <div className="mb-6">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Overview
            </div>
            <div className="space-y-1">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                    color: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  }}
                >
                  <NavIcon type={link.icon} />
                  <span className={`text-sm ${isActive(link.href) ? 'font-medium' : ''}`}>
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Management Section */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Management
            </div>
            <div className="space-y-1">
              {managementLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                    color: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  }}
                >
                  <NavIcon type={link.icon} />
                  <span className={`text-sm ${isActive(link.href) ? 'font-medium' : ''}`}>
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* User & Portal Section */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* User Info */}
          {session?.user && (
            <div className="mb-3 px-3">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {session.user.name || 'User'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {session.user.email}
              </div>
            </div>
          )}

          {/* Sign Out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <NavIcon type="logout" />
            <span className="text-sm">Sign Out</span>
          </button>

          {/* Back to Portal */}
          <a
            href="https://portal.christmasair.com"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5 mt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            <NavIcon type="arrow" />
            <span className="text-sm">Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
