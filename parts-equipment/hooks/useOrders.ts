'use client';
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';
import type { PEOrder, PEWarrantyClaim, PEAuditLog } from '@/types';
import { supabase } from '@/lib/supabase';
import { PE_CHANGES_TOPIC } from '@/lib/realtime';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

/** One other person currently editing a specific line on a board. */
export interface PresencePeer {
  key: string;
  name: string;
  board: 'service' | 'install' | 'warranty';
  rowId: number;
}

export type BoardName = 'service' | 'install' | 'warranty';

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
  presence: PresencePeer[];
  setEditing: (board: BoardName, rowId: number | null) => void;
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
  const [presence, setPresence] = useState<PresencePeer[]>([]);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });

  // Who am I (for presence)? App uses NextAuth, so grab the display name from the session.
  const { data: session } = useSession();
  const nameRef = useRef('Someone');
  nameRef.current = session?.user?.name || session?.user?.email || 'Someone';

  // Presence channel + a debounce timer that clears "I'm editing" shortly after blur
  // (so hopping between cells in the same row doesn't flicker off on other screens).
  const presenceChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const clearEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce timers: one per order ID
  // Timestamp of the last local edit — a live refresh is deferred while the user
  // is actively typing so it can't clobber their in-progress (unsaved) keystrokes.
  const lastEditRef = useRef(0);
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

  // Live collaboration: another user's save (or the sync) broadcasts a "change"
  // ping on a shared channel; we refetch so everyone stays in sync — Google-Sheets
  // style. Only a ping travels the channel (no order data). Defer the refetch while
  // the local user is actively typing (last edit < 1.5s ago) so we never overwrite
  // their unsaved keystrokes.
  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const doRefresh = () => {
      const idleFor = Date.now() - lastEditRef.current;
      if (idleFor < 1500) {
        timer = setTimeout(doRefresh, 1500 - idleFor);
        return;
      }
      refresh();
    };
    const channel = supabase
      .channel(PE_CHANGES_TOPIC)
      .on('broadcast', { event: 'change' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(doRefresh, 400);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Line-level presence: everyone joins one channel and "tracks" which row (if any)
  // they're currently editing. On every sync we rebuild the list of OTHER people and
  // which line they're on, so each board can show a little avatar next to that row —
  // Google-Sheets style. Only name + board + row id travel the channel (no order data).
  useEffect(() => {
    if (!supabase) return;
    const myKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `k-${Math.floor(performance.now())}-${performance.now()}`;
    const channel = supabase.channel('pe-presence', { config: { presence: { key: myKey } } });
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<
          string,
          Array<{ name: string; board: BoardName | null; rowId: number | null }>
        >;
        const peers: PresencePeer[] = [];
        for (const key of Object.keys(state)) {
          if (key === myKey) continue;
          const metas = state[key];
          const m = metas && metas[metas.length - 1];
          if (m && m.board && m.rowId != null) {
            peers.push({ key, name: m.name || 'Someone', board: m.board, rowId: m.rowId });
          }
        }
        setPresence(peers);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ name: nameRef.current, board: null, rowId: null });
        }
      });

    return () => {
      if (clearEditTimer.current) clearTimeout(clearEditTimer.current);
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when a row gains/loses focus. rowId=null clears (debounced so cell-to-cell
  // hops within the same row don't blink the indicator off for everyone else).
  const setEditing = useCallback((board: BoardName, rowId: number | null) => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    if (clearEditTimer.current) {
      clearTimeout(clearEditTimer.current);
      clearEditTimer.current = null;
    }
    if (rowId === null) {
      clearEditTimer.current = setTimeout(() => {
        channel.track({ name: nameRef.current, board: null, rowId: null });
      }, 800);
    } else {
      channel.track({ name: nameRef.current, board, rowId });
    }
  }, []);

  const updateOrder = useCallback((id: number, changes: Partial<PEOrder>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));
  }, []);

  const saveOrderDebounced = useCallback((id: number, changes: Partial<PEOrder>) => {
    lastEditRef.current = Date.now();
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
    presence,
    setEditing,
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
