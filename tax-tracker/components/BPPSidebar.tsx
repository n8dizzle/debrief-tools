'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';

const assetLinks = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/assets', label: 'Assets', icon: 'clipboard' },
  { href: '/categories', label: 'Categories', icon: 'folder' },
  { href: '/import', label: 'Import', icon: 'upload', permission: 'canManageAssets' },
];

const renditionLinks = [
  { href: '/renditions', label: 'Renditions', icon: 'document' },
  { href: '/depreciation', label: 'Depreciation', icon: 'calculator' },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    clipboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    folder: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    document: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    calculator: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    upload: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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

interface BPPSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function BPPSidebar({ isOpen = true, onClose }: BPPSidebarProps) {
  const pathname = usePathname();
  const permissions = useBPPPermissions();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const filteredAssetLinks = assetLinks.filter(
    link => !link.permission || (permissions as any)[link.permission]
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
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--christmas-green)' }}>
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>Christmas Air</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tax Tracker</div>
            </div>
          </Link>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {/* Assets Section */}
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-3" style={{ color: 'var(--text-muted)' }}>Assets</div>
            <div className="space-y-1">
              {filteredAssetLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                    color: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  }}
                >
                  <NavIcon type={link.icon} />
                  <span className={`text-sm ${isActive(link.href) ? 'font-medium' : ''}`}>{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Renditions Section */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-3" style={{ color: 'var(--text-muted)' }}>Renditions</div>
            <div className="space-y-1">
              {renditionLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isActive(link.href) ? 'var(--christmas-green)' : 'transparent',
                    color: isActive(link.href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  }}
                >
                  <NavIcon type={link.icon} />
                  <span className={`text-sm ${isActive(link.href) ? 'font-medium' : ''}`}>{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <a href="https://portal.christmasair.com" className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <NavIcon type="arrow" />
            <span className="text-sm">Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
