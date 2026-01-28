'use client';

import { useState } from 'react';
import ARSidebar from './ARSidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            AR Collections
          </span>
        </div>

        {/* Spacer to balance the header */}
        <div className="w-10" />
      </header>

      {/* Sidebar */}
      <ARSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-6 xl:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
