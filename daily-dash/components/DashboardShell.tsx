'use client';

import { useState } from 'react';
import DashSidebar from './DashSidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <DashSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--christmas-cream)' }}>
            Daily Dash
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
