'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHRPermissions } from '@/hooks/useHRPermissions';

const navLinks = [
  { href: '/ladder', label: 'Career Ladder', icon: 'ladder' },
  { href: '/ladders', label: 'Manage Ladders', icon: 'settings', requiresEdit: true },
  { href: '/onboarding', label: 'Onboarding', icon: 'clipboard' },
  { href: '/people', label: 'People', icon: 'people' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    ladder: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 3v18M16 3v18M8 6h8M8 10h8M8 14h8M8 18h8" />
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
    people: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    arrow: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
  };
  return icons[type] || icons.ladder;
}

interface HRSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  desktopCollapsed?: boolean;
  onToggleDesktopCollapsed?: () => void;
}

export default function HRSidebar({
  isOpen = true,
  onClose,
  desktopCollapsed = false,
  onToggleDesktopCollapsed,
}: HRSidebarProps) {
  const pathname = usePathname();
  const { canEditLadder } = useHRPermissions();
  const links = navLinks.filter((l) => !l.requiresEdit || canEditLadder);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  const handleLinkClick = () => onClose?.();

  const lgHideWhenCollapsed = desktopCollapsed ? 'lg:hidden' : '';
  const lgJustifyWhenCollapsed = desktopCollapsed ? 'lg:justify-center lg:px-0' : '';

  return (
    <>
      {isOpen && onClose && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 flex flex-col z-50
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${desktopCollapsed ? 'lg:w-16' : 'lg:w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Logo */}
        <div
          className={`p-4 border-b flex items-center justify-between ${desktopCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Link href="/ladder" className="flex items-center gap-3" onClick={handleLinkClick}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--christmas-green)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="var(--on-accent)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v18M16 3v18M8 6h8M8 10h8M8 14h8M8 18h8" />
              </svg>
            </div>
            <div className={lgHideWhenCollapsed}>
              <div className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                Christmas Air
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                HR Hub
              </div>
            </div>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {onToggleDesktopCollapsed && (
          <button
            onClick={onToggleDesktopCollapsed}
            className="hidden lg:flex items-center justify-end pr-3 py-2 border-b hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${desktopCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleLinkClick}
                title={desktopCollapsed ? link.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${lgJustifyWhenCollapsed}`}
                style={{
                  backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                  color: isActive(link.href) ? 'var(--on-accent)' : 'var(--text-secondary)',
                }}
              >
                <NavIcon type={link.icon} />
                <span className={`text-sm ${isActive(link.href) ? 'font-medium' : ''} ${lgHideWhenCollapsed}`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <a
            href="https://portal.christmasair.com"
            title={desktopCollapsed ? 'Back to Portal' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${lgJustifyWhenCollapsed}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <NavIcon type="arrow" />
            <span className={`text-sm ${lgHideWhenCollapsed}`}>Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
