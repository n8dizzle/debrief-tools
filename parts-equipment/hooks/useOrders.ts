'use client';
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import type { PEOrder, PEWarrantyClaim, PEAuditLog } from '@/types';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

export interface OrdersContextValue {
  orders: PEOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PEOrder[]>>;
  warrantyOrders: PEWarrantyClaim[];
  setWarrantyOrders: React.Dispatch<React.SetStateAction<PEWarrantyClaim[]>>;
  auditLog: PEAuditLog[];
  setAuditLog: React.Dispatch<React.SetStateAction<PEAuditLog[]>>;
  isLoading: boolean;
  lastSync: Date | null;
  installTeams: string[];
  suppliers: string[];
  validities: string[];
  refresh: () => Promise<void>;
  refreshInstallTeams: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  refreshValidities: () => Promise<void>;
  updateOrder: (id: number, changes: Partial<PEOrder>) => void;
  saveOrderDebounced: (id: number, changes: Partial<PEOrder>) => void;
  createOrder: (order: Partial<PEOrder>) => Promise<PEOrder | null>;
  logAudit: (entry: Partial<PEAuditLog>) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  toast: ToastState;
  // Modal openers — injected by AppShell
  openWizard?: () => void;
  openEditDetail?: (orderId: number) => void;
  openCloseout?: (orderId: number) => void;
  openAudit?: () => void;
  openColSettings?: (tableType: 'service' | 'install') => void;
}

export const OrdersContext = createContext<OrdersContextValue | null>(null);

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside OrdersContext.Provider');
  return ctx;
}

export function useOrdersProvider(): OrdersContextValue {
  const [orders, setOrders] = useState<PEOrder[]>([]);
  const [warrantyOrders, setWarrantyOrders] = useState<PEWarrantyClaim[]>([]);
  const [auditLog, setAuditLog] = useState<PEAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [installTeams, setInstallTeams] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [validities, setValidities] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });

  // Debounce timers: one per order ID
  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Accumulate changes per order during debounce window
  const pendingChanges = useRef<Map<number, Partial<PEOrder>>>(new Map());

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  const refreshInstallTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/install-teams');
      if (res.ok) {
        const { teams } = await res.json();
        setInstallTeams(
          (teams || [])
            .filter((t: { active: boolean }) => t.active)
            .map((t: { name: string }) => t.name)
        );
      }
    } catch (e) {
      console.error('Failed to load install teams:', e);
    }
  }, []);

  const refreshSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const { suppliers: data } = await res.json();
        setSuppliers(
          (data || [])
            .filter((s: { active: boolean }) => s.active)
            .map((s: { name: string }) => s.name)
        );
      }
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    }
  }, []);

  const refreshValidities = useCallback(async () => {
    try {
      const res = await fetch('/api/validities');
      if (res.ok) {
        const { validities: data } = await res.json();
        setValidities(
          (data || [])
            .filter((v: { active: boolean }) => v.active)
            .map((v: { name: string }) => v.name)
        );
      }
    } catch (e) {
      console.error('Failed to load validities:', e);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [ordersRes, warrantyRes, auditRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/warranty'),
        fetch('/api/audit'),
      ]);
      if (ordersRes.ok) {
        const { orders: data } = await ordersRes.json();
        setOrders(data || []);
      }
      if (warrantyRes.ok) {
        const { claims } = await warrantyRes.json();
        setWarrantyOrders(claims || []);
      }
      if (auditRes.ok) {
        const { entries } = await auditRes.json();
        setAuditLog(entries || []);
      }
      setLastSync(new Date());
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshInstallTeams();
    refreshSuppliers();
    refreshValidities();
  }, [refresh, refreshInstallTeams, refreshSuppliers, refreshValidities]);

  const updateOrder = useCallback((id: number, changes: Partial<PEOrder>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));
  }, []);

  const saveOrderDebounced = useCallback((id: number, changes: Partial<PEOrder>) => {
    // Optimistically update UI immediately
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));

    // Accumulate changes
    const existing = pendingChanges.current.get(id) || {};
    pendingChanges.current.set(id, { ...existing, ...changes });

    // Clear existing timer
    const existingTimer = debounceTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new 500ms timer
    const timer = setTimeout(async () => {
      const allChanges = pendingChanges.current.get(id);
      if (!allChanges) return;
      pendingChanges.current.delete(id);
      debounceTimers.current.delete(id);

      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allChanges),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(`Save failed: ${err.error || 'Unknown error'}`, 'error');
        }
      } catch {
        showToast('Save failed — check connection', 'error');
      }
    }, 500);

    debounceTimers.current.set(id, timer);
  }, [showToast]);

  const createOrder = useCallback(async (order: Partial<PEOrder>): Promise<PEOrder | null> => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (!res.ok) throw new Error('Failed to create order');
      const { order: newOrder } = await res.json();
      setOrders(prev => [newOrder, ...prev]);
      showToast('Order created!', 'success');
      return newOrder;
    } catch {
      showToast('Failed to create order', 'error');
      return null;
    }
  }, [showToast]);

  const logAudit = useCallback(async (entry: Partial<PEAuditLog>): Promise<void> => {
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const { entry: newEntry } = await res.json();
        setAuditLog(prev => [newEntry, ...prev]);
      }
    } catch {}
  }, []);

  return {
    orders,
    setOrders,
    warrantyOrders,
    setWarrantyOrders,
    auditLog,
    setAuditLog,
    isLoading,
    lastSync,
    installTeams,
    suppliers,
    validities,
    refresh,
    refreshInstallTeams,
    refreshSuppliers,
    refreshValidities,
    updateOrder,
    saveOrderDebounced,
    createOrder,
    logAudit,
    showToast,
    toast,
  };
}
