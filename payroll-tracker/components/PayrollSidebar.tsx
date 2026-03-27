'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';

const mainLinks = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/employees', label: 'Employees', icon: 'users' },
  { href: '/periods', label: 'Pay Periods', icon: 'calendar' },
  { href: '/timesheets', label: 'Timesheets', icon: 'clock' },
  { href: '/overtime', label: 'Overtime', icon: 'trending-up', requiresManager: true },
  { href: '/reviews', label: 'Reviews', icon: 'clipboard-check', requiresManager: true },
  { href: '/settings', label: 'Settings', icon: 'settings', requiresManager: true },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    clock: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'trending-up': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    'clipboard-check': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    arrow: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
  };

  return icons[type] || icons.home;
}

interface PayrollSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function PayrollSidebar({ isOpen = true, onClose }: PayrollSidebarProps) {
  const pathname = usePathname();
  const { isManager, isOwner } = usePayrollPermissions();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const filteredLinks = mainLinks.filter(
    link => !link.requiresManager || isManager || isOwner
  );

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

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
          <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>
                Christmas Air
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Payroll Tracker
              </div>
            </div>
          </Link>

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
          <div className="mb-6">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Payroll
            </div>
            <div className="space-y-1">
              {filteredLinks.map((link) => (
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
