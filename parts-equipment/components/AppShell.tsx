'use client';
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { OrdersContext, useOrdersProvider } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import PESidebar from './PESidebar';

// Dynamic imports for all modals — no SSR
const NewOrderWizard = dynamic(() => import('./NewOrderWizard'), { ssr: false });
const EditDetailModal = dynamic(() => import('./EditDetailModal'), { ssr: false });
const CloseoutModal = dynamic(() => import('./CloseoutModal'), { ssr: false });
const AuditPanel = dynamic(() => import('./AuditPanel'), { ssr: false });
const ColSettingsPanel = dynamic(() => import('./ColSettingsPanel'), { ssr: false });
const PresenceBar = dynamic(() => import('./PresenceBar'), { ssr: false });

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Skip shell on login page
  const isLoginPage = pathname === '/login' || pathname?.startsWith('/login');

  // Sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem('pe_sidebar_collapsed') === '1');
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pe_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

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

  const { toast } = ordersBase;

  return (
    <OrdersContext.Provider value={ctxValue}>
      <div className={`pe-layout${collapsed ? ' collapsed' : ''}`}>
        <PESidebar
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />

        <div className="pe-main">
          {/* Top bar — page-global actions (nav lives in the sidebar) */}
          <header className="pe-topbar">
            <button className="pe-hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="pe-topbar-spacer" />
            <div className="header-right">
              <PresenceBar users={ordersBase.activeUsers} />
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
            </div>
          </header>

          {/* Page content */}
          <main className="pe-content">{children}</main>
        </div>
      </div>

      {/* Modals */}
      {wizardOpen && <NewOrderWizard onClose={() => setWizardOpen(false)} />}
      {editDetailId !== null && <EditDetailModal orderId={editDetailId} onClose={() => setEditDetailId(null)} />}
      {closeoutId !== null && <CloseoutModal orderId={closeoutId} onClose={() => setCloseoutId(null)} />}
      {auditOpen && <AuditPanel onClose={() => setAuditOpen(false)} />}
      {colSettingsType !== null && <ColSettingsPanel tableType={colSettingsType} onClose={() => setColSettingsType(null)} />}

      {/* Toast notification */}
      <div className={`toast${toast.visible ? ' show' : ''}${toast.type === 'error' ? ' toast-error' : toast.type === 'info' ? ' toast-info' : ''}`}>
        {toast.message}
      </div>
    </OrdersContext.Provider>
  );
}
