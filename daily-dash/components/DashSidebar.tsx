'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface DashSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const overviewLinks = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/pacing', label: 'Goal Pacing', icon: 'target' },
  { href: '/huddle', label: 'Daily Huddle', icon: 'clipboard' },
  { href: '/huddle/history', label: 'History', icon: 'calendar' },
  { href: '/reviews', label: 'Reviews', icon: 'star' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const departmentLinks = [
  { href: '/christmas-overall', label: 'Christmas (Overall)', slug: 'christmas-overall' },
  { href: '/hvac-overall', label: 'HVAC Overall', slug: 'hvac-overall' },
  { href: '/hvac-install', label: 'HVAC Install', slug: 'hvac-install', indent: true },
  { href: '/hvac-service', label: 'HVAC Service', slug: 'hvac-service', indent: true },
  { href: '/hvac-maintenance', label: 'HVAC Maintenance', slug: 'hvac-maintenance', indent: true },
  { href: '/plumbing', label: 'Plumbing', slug: 'plumbing' },
  { href: '/call-center', label: 'Call Center', slug: 'call-center' },
  { href: '/marketing', label: 'Marketing', slug: 'marketing' },
  { href: '/finance', label: 'Finance', slug: 'finance' },
  { href: '/warehouse', label: 'Warehouse', slug: 'warehouse' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    target: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    clipboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    star: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    arrow: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };

  return icons[type] || icons.home;
}

export default function DashSidebar({ isOpen = false, onClose }: DashSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>
              Christmas Air
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Daily Dash
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
        {/* Overview Section */}
        <div className="mb-6">
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Overview
          </div>
          <div className="space-y-1">
            {overviewLinks.map((link) => (
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

        {/* Departments Section */}
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Departments
          </div>
          <div className="space-y-0.5">
            {departmentLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 py-1.5 rounded-lg transition-colors ${
                  'indent' in link && link.indent ? 'pl-6 pr-3' : 'px-3'
                }`}
                style={{
                  backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                  color: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
              >
                <div
                  className={`rounded-full ${'indent' in link && link.indent ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
                  style={{ backgroundColor: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-muted)' }}
                />
                <span className={`${'indent' in link && link.indent ? 'text-xs' : 'text-sm'} ${isActive(link.href) ? 'font-medium' : ''}`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Back to Portal */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <a
          href="https://portal.christmasair.com"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
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
