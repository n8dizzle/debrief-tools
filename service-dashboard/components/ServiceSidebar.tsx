'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useServiceDashboardPermissions } from '@/hooks/usePermissions';

const mainLinks = [
  { href: '/', label: 'Leaderboard', icon: 'trophy' },
  { href: '/attendance', label: 'Attendance', icon: 'clipboard' },
];

const managementLinks = [
  { href: '/settings', label: 'Settings', icon: 'settings', requiresManager: true },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    trophy: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    clipboard: (
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
  };

  return icons[type] || icons.trophy;
}

interface ServiceSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ServiceSidebar({ isOpen = true, onClose }: ServiceSidebarProps) {
  const pathname = usePathname();
  const { isManager, isOwner } = useServiceDashboardPermissions();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const filteredManagementLinks = managementLinks.filter(
    link => !link.requiresManager || isManager || isOwner
  );

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && onClose && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
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
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>
                Christmas Air
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Service Dashboard
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

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-3" style={{ color: 'var(--text-muted)' }}>
              Dashboard
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

          {filteredManagementLinks.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-3" style={{ color: 'var(--text-muted)' }}>
                Management
              </div>
              <div className="space-y-1">
                {filteredManagementLinks.map((link) => (
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
          )}
        </nav>

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
