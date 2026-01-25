'use client';

import { useState } from 'react';
import MarketingSidebar from './MarketingSidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <MarketingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile header with hamburger */}
      <div
        className="fixed top-0 left-0 right-0 z-30 md:hidden flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--christmas-green)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Hub
          </span>
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-10" />
      </div>

      <main className="md:ml-64">
        {/* Add top padding on mobile for the fixed header */}
        <div className="p-4 pt-20 sm:p-6 md:pt-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
