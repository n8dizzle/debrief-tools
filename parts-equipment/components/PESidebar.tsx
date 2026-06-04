'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PESidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function BoxIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

const navLinks = [
  { href: '/', label: 'Orders Board', Icon: BoxIcon },
  { href: '/audit', label: 'Audit Log', Icon: ClipboardIcon },
];

export default function PESidebar({ isOpen = true, onClose }: PESidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {isOpen && onClose && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--christmas-green)' }}>
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--christmas-cream)' }}>Christmas Air</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Parts & Equipment</div>
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Parts Orders
          </div>
          <div className="space-y-1">
            {navLinks.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: isActive(href) ? 'var(--christmas-green)' : 'transparent',
                  color: isActive(href) ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
              >
                <Icon />
                <span className={`text-sm ${isActive(href) ? 'font-medium' : ''}`}>{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Back to Portal */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <a
            href="https://portal.christmasair.com"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowIcon />
            <span className="text-sm">Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
