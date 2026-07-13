'use client';

import { useEffect, useState } from 'react';
import APSidebar from './APSidebar';
import { AnalyticsTracker } from './AnalyticsTracker';

interface DashboardShellProps {
  children: React.ReactNode;
}

const COLLAPSE_STORAGE_KEY = 'ap_sidebar_collapsed';

export default function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1') setDesktopCollapsed(true); } catch { /* ignore */ }
  }, []);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <AnalyticsTracker app="ap_payments" />
      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--christmas-green)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            AP Payments
          </span>
        </div>

        <div className="w-10" />
      </header>

      <APSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        desktopCollapsed={desktopCollapsed} onToggleDesktopCollapsed={toggleDesktopCollapsed} />

      <main className={`transition-[margin] duration-300 ease-in-out pt-16 lg:pt-0 ${desktopCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 xl:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
