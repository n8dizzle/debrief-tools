'use client';
import { useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { OrdersContext, useOrdersProvider } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';

// Dynamic imports for all modals — no SSR
const NewOrderWizard = dynamic(() => import('./NewOrderWizard'), { ssr: false });
const EditDetailModal = dynamic(() => import('./EditDetailModal'), { ssr: false });
const CloseoutModal = dynamic(() => import('./CloseoutModal'), { ssr: false });
const AuditPanel = dynamic(() => import('./AuditPanel'), { ssr: false });
const ColSettingsPanel = dynamic(() => import('./ColSettingsPanel'), { ssr: false });

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Skip shell on login page
  const isLoginPage = pathname === '/login' || pathname?.startsWith('/login');

  // Modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editDetailId, setEditDetailId] = useState<number | null>(null);
  const [closeoutId, setCloseoutId] = useState<number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [colSettingsType, setColSettingsType] = useState<'service' | 'install' | null>(null);

  // Modal openers
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const openEditDetail = useCallback((id: number) => setEditDetailId(id), []);
  const openCloseout = useCallback((id: number) => setCloseoutId(id), []);
  const openAudit = useCallback(() => setAuditOpen(true), []);
  const openColSettings = useCallback((t: 'service' | 'install') => setColSettingsType(t), []);

  // Base orders state from hook
  const ordersBase = useOrdersProvider();

  // Enrich context with modal openers
  const ctxValue: OrdersContextValue = {
    ...ordersBase,
    openWizard,
    openEditDetail,
    openCloseout,
    openAudit,
    openColSettings,
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  const tabs = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/service', label: 'Service' },
    { path: '/install', label: 'Install' },
    { path: '/warranty', label: 'Warranty Tracker' },
  ];

  const { toast } = ordersBase;

  return (
    <OrdersContext.Provider value={ctxValue}>
      {/* Header */}
      <header>
        <div className="logo">
          <div className="logo-mark">CA</div>
          <div>
            <div className="logo-text">
              Christmas Air <span className="logo-sub">/ Parts &amp; Equipment</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="last-sync">
            <span className="sync-dot" />
            {ordersBase.lastSync
              ? `Synced ${ordersBase.lastSync.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
              : 'Loading...'}
          </div>
          <button className="btn" onClick={() => ordersBase.refresh()} style={{ fontSize: 12, padding: '5px 12px' }}>
            ↺ Refresh
          </button>
          <button className="btn btn-primary" onClick={openWizard} style={{ fontSize: 13 }}>
            + New Order
          </button>
          {session?.user && (
            <button
              className="btn"
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }}
              title={`Signed in as ${session.user.email}`}
            >
              {session.user.name?.split(' ')[0] || 'Sign Out'} ↩
            </button>
          )}
        </div>
      </header>

      {/* Nav tabs */}
      <div className="page-tabs">
        {tabs.map(tab => (
          <button
            key={tab.path}
            className={`page-tab${pathname === tab.path || (tab.path !== '/dashboard' && pathname?.startsWith(tab.path)) ? ' active' : ''}`}
            onClick={() => router.push(tab.path)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      {children}

      {/* Modals */}
      {wizardOpen && (
        <NewOrderWizard
          onClose={() => setWizardOpen(false)}
        />
      )}

      {editDetailId !== null && (
        <EditDetailModal
          orderId={editDetailId}
          onClose={() => setEditDetailId(null)}
        />
      )}

      {closeoutId !== null && (
        <CloseoutModal
          orderId={closeoutId}
          onClose={() => setCloseoutId(null)}
        />
      )}

      {auditOpen && (
        <AuditPanel
          onClose={() => setAuditOpen(false)}
        />
      )}

      {colSettingsType !== null && (
        <ColSettingsPanel
          tableType={colSettingsType}
          onClose={() => setColSettingsType(null)}
        />
      )}

      {/* Toast notification */}
      <div className={`toast${toast.visible ? ' show' : ''}${toast.type === 'error' ? ' toast-error' : toast.type === 'info' ? ' toast-info' : ''}`}>
        {toast.message}
      </div>
    </OrdersContext.Provider>
  );
}
