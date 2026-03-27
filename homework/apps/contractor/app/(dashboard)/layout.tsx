'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { createBrowserClient } from '@/lib/supabase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setBusinessName(user.user_metadata?.business_name || '');
      }
    }
    getUser();
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          transition: 'margin-left 0.2s ease',
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 'var(--header-height)',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.375rem 0.625rem',
                borderRadius: '8px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--hw-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                {(businessName || userEmail || '?')[0].toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
                  {businessName || 'My Business'}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {userEmail}
                </div>
              </div>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {userMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  width: '200px',
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: 'var(--status-error)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '1.5rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
