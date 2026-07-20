'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePEPermissions } from '@/hooks/usePEPermissions';

interface NavLink {
  href: string;
  label: string;
  icon: string;
  manage?: boolean;
}

interface NavSection {
  heading: string;
  links: NavLink[];
  wip?: boolean;   // renders items italic/muted — not-yet-final features
}

const SECTIONS: NavSection[] = [
  {
    heading: 'Boards',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/service', label: 'Service', icon: 'wrench' },
      { href: '/install', label: 'Install', icon: 'box' },
      { href: '/warranty', label: 'Warranty Tracker', icon: 'shield' },
    ],
  },
  {
    heading: 'Work in Progress 🚧',
    wip: true,
    links: [
      { href: '/parts', label: 'Parts Board', icon: 'board' },
      { href: '/warehouse', label: 'Warehouse Board', icon: 'box' },
    ],
  },
  {
    heading: 'Manage',
    links: [{ href: '/settings', label: 'Settings', icon: 'settings', manage: true }],
  },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    wrench: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />,
    box: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
    board: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v9h-4z" />,
    settings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
    portal: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />,
  };
  return (
    <svg className="pe-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      {icons[type] || icons.home}
    </svg>
  );
}

interface PESidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function PESidebar({ isOpen = true, onClose, collapsed = false, onToggleCollapsed }: PESidebarProps) {
  const pathname = usePathname();
  const { canManage } = usePEPermissions();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || (pathname?.startsWith(href + '/') ?? false);

  const sections = SECTIONS
    .map(s => ({ ...s, links: s.links.filter(l => !l.manage || canManage) }))
    .filter(s => s.links.length > 0);

  return (
    <>
      {isOpen && onClose && <div className="pe-sidebar-scrim" onClick={onClose} />}

      <aside className={`pe-sidebar${collapsed ? ' collapsed' : ''}${isOpen ? ' open' : ''}`}>
        <div className="pe-sidebar-brand">
          <Link href="/dashboard" className="pe-brand-link" onClick={onClose}>
            <div className="pe-brand-tile">
              <svg fill="none" stroke="var(--on-accent)" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="pe-brand-text">
              <div className="pe-brand-name">Christmas Air</div>
              <div className="pe-brand-sub">Parts &amp; Equipment</div>
            </div>
          </Link>
          {onClose && (
            <button className="pe-sidebar-close" onClick={onClose} aria-label="Close menu">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {onToggleCollapsed && (
          <button
            className="pe-collapse-toggle"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={collapsed ? 'flipped' : ''} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}

        <nav className="pe-nav">
          {sections.map(section => (
            <div key={section.heading} className="pe-nav-section">
              <div className="pe-nav-heading">{section.heading}</div>
              {section.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  title={collapsed ? link.label : undefined}
                  className={`pe-nav-item${isActive(link.href) ? ' active' : ''}`}
                  style={section.wip ? { fontStyle: 'italic' } : undefined}
                >
                  <NavIcon type={link.icon} />
                  <span className="pe-nav-label">{link.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="pe-sidebar-footer">
          <a href="https://portal.christmasair.com" className="pe-nav-item" title={collapsed ? 'Back to Portal' : undefined}>
            <NavIcon type="portal" />
            <span className="pe-nav-label">Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
