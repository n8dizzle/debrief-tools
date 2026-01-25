'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface MarketingSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navLinks = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/posts', label: 'GBP Posts', icon: 'megaphone' },
  { href: '/lsa', label: 'Local Service Ads', icon: 'phone' },
  { href: '/performance', label: 'GBP Insights', icon: 'chart-bar' },
  { href: '/analytics', label: 'Website Analytics', icon: 'globe' },
  { href: '/social', label: 'Social Media', icon: 'share' },
  { href: '/tasks', label: 'Tasks', icon: 'checklist' },
];

const settingsLinks = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    megaphone: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    phone: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    'chart-bar': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    globe: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    share: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    checklist: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    logout: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    chevron: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ),
  };

  return icons[type] || icons.home;
}

export default function MarketingSidebar({ isOpen = false, onClose }: MarketingSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isOwner = session?.user?.role === 'owner';

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close profile menu on route change
  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) {
      onClose();
    }
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 flex flex-col z-50
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Logo Section */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>
                Christmas Air
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Marketing Hub
              </div>
            </div>
          </Link>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-white/10"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Main Navigation */}
          <div className="mb-6">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Marketing
            </div>
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
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

          {/* Settings Section */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
              style={{ color: 'var(--text-muted)' }}
            >
              System
            </div>
            <div className="space-y-1">
              {settingsLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
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

        {/* Profile Section */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }} ref={profileMenuRef}>
          <div className="relative">
            {/* Profile Button */}
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
              >
                {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--christmas-cream)' }}>
                  {session?.user?.name || session?.user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {session?.user?.role === 'owner' ? 'Owner' : session?.user?.role === 'manager' ? 'Manager' : 'Employee'}
                </div>
              </div>
              <div
                className={`transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--text-muted)' }}
              >
                <NavIcon type="chevron" />
              </div>
            </button>

            {/* Dropdown Menu */}
            {profileMenuOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-2 rounded-lg overflow-hidden shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <NavIcon type="settings" />
                  <span className="text-sm">Settings</span>
                </Link>

                {isOwner && (
                  <Link
                    href="/users"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <NavIcon type="users" />
                    <span className="text-sm">Manage Users</span>
                  </Link>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                    style={{ color: '#ef4444' }}
                  >
                    <NavIcon type="logout" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back to Portal */}
        <div className="px-4 pb-4">
          <a
            href="https://portal.christmasair.com"
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <NavIcon type="arrow" />
            <span className="text-xs">Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
