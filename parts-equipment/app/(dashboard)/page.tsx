'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { POOrder } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────

const OWNERS = ['CXR', 'Warehouse', 'Service Manager', 'Install Manager', 'Sales', 'Rachel'];
const LOCATIONS = [
  'Place Order', 'Shipping to Shop', 'Backordered', 'Lewisville Shop',
  'P/U Supply House', 'Waiting for Tech/Cus', 'Shipping to Supplier',
  'Cancel PO', 'Duct Cleaning - Schedule',
];
const SUPPLIERS = [
  'STOCK', 'Shear - Allen', 'Shear - Carr', 'Shear - Den', 'Shear - FW',
  'CE - Allen', 'CE - Carr', 'CE - Dallas', 'CE - Denton', 'CE - FW', 'CE - SW FW', 'CE - Gar', 'CE - Sher',
  'Lennox - Allen', 'Lennox - Carr', 'Lennox Ft Worth', 'Lennox - Grand Prairie', 'Lennox - Lew', 'Lennox - Southlake', 'Lennox Garland',
  'Good - Allen', 'Good - Carr', 'Good - Den', 'Good - NFW',
  'Century Supply - Dallas', 'Century Supply - Fort Worth', 'Century Supply - Richardson',
  'Reece - Den', 'Reece (Carrollton)', 'Reece - Gar',
  'Baker Denton', 'Baker Lewisville', 'AACA Lewisville', 'AC Supply', 'Amazon', 'Am. Stand.',
  'AMSCO', 'Barsco Denton', 'Ferguson', 'FISSCO Supply - Denton', 'Gemaire',
  'Home Depot', 'INSCO', 'Johnson (N. Beach)', 'Johnstone Supply', 'Locke',
  'M&M Metals', 'ONLINE SITE', 'RepairClinic.com', 'Standard Supply',
  'SupplyHouse.com', 'Trane', 'United Refrigeration', 'WinSupply',
];
const TECHS = ['Keith', 'Jack', 'Jacob', 'Kaileb', 'Santi', 'Jonathan', 'Braulio', 'Eduardo', 'John', 'Brett', 'Luke', 'Phil', 'Eric'];
const WARRANTIES = ['No', 'P', 'P/L', 'E/L', 'E'];
const JOB_TYPES = ['Parts', 'W/Parts', 'Equipment', 'Insulation', 'Duct Cleaning'];
const CANCEL_SOURCES = [
  'Customer requested cancellation',
  'Customer unreachable — 3 texts & 3 calls exhausted',
  'Customer declined after follow-up',
  'Duplicate order',
  'Tech resolved without part',
  'Other',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function ownerForLocation(loc: string, isEquipment: boolean): string {
  if (['Place Order', 'Shipping to Shop', 'P/U Supply House', 'Shipping to Supplier'].includes(loc)) return 'Warehouse';
  if (loc === 'Lewisville Shop') return isEquipment ? 'Install Manager' : 'CXR';
  if (loc === 'Backordered') return 'CXR';
  if (loc === 'Waiting for Tech/Cus') return 'Service Manager';
  if (loc === 'Duct Cleaning - Schedule') return 'Rachel';
  return '';
}

function getRowStyle(order: POOrder): React.CSSProperties {
  if (order.location === 'Backordered') return { background: 'rgba(234,179,8,0.12)', borderLeft: '4px solid #c8b800' };
  if (order.location === 'Cancel PO') return { background: 'rgba(249,115,22,0.12)', borderLeft: '4px solid #e07000' };
  if (order.scheduled_date) return { background: 'rgba(34,197,94,0.1)', borderLeft: '4px solid #0e7a50' };
  if (order.owner === 'Warehouse') return { background: 'rgba(59,130,246,0.07)', borderLeft: '4px solid #2d6be4' };
  if (order.owner === 'CXR') return { background: 'rgba(34,197,94,0.05)', borderLeft: '4px solid #1a9e6a' };
  if (order.owner === 'Rachel') return { background: 'rgba(20,184,166,0.05)', borderLeft: '4px solid #1a9aaa' };
  if (daysSince(order.date_added) > 30) return { borderLeft: '4px solid #d63b3b' };
  return {};
}

function getOwnerStyle(owner: string | null): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    'CXR':             { background: 'rgba(124,92,191,0.15)', color: '#a07ee0' },
    'Warehouse':       { background: 'rgba(26,158,106,0.15)', color: '#4ade80' },
    'Service Manager': { background: 'rgba(214,59,59,0.15)',  color: '#f87171' },
    'Install Manager': { background: 'rgba(26,154,170,0.15)', color: '#22d3ee' },
    'Sales':           { background: 'rgba(212,138,10,0.15)', color: '#fbbf24' },
    'Rachel':          { background: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
  };
  return map[owner || ''] || { background: 'rgba(107,117,146,0.15)', color: '#94a3b8' };
}

function getLocationStyle(loc: string | null): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    'Place Order':             { background: 'rgba(212,138,10,0.15)',  color: '#fbbf24' },
    'Shipping to Shop':        { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'Shipping to Supplier':    { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'Lewisville Shop':         { background: 'rgba(26,154,170,0.15)',  color: '#22d3ee' },
    'P/U Supply House':        { background: 'rgba(124,92,191,0.15)',  color: '#a78bfa' },
    'Backordered':             { background: 'rgba(214,59,59,0.15)',   color: '#f87171' },
    'Waiting for Tech/Cus':    { background: 'rgba(212,138,10,0.15)',  color: '#fbbf24' },
    'Duct Cleaning - Schedule':{ background: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
    'Cancel PO':               { background: 'rgba(107,117,146,0.15)', color: '#94a3b8' },
  };
  return map[loc || ''] || { background: 'rgba(107,117,146,0.15)', color: '#94a3b8' };
}

// ─── Empty add form state ────────────────────────────────────────────────────

const emptyAdd = {
  date: '', job: '', tech: '', type: 'Parts', customer: '',
  owner: 'CXR', warranty: 'No', part: '', isEquipment: false,
  supplier: '', location: 'Place Order', orderNum: '', cost: '', notesWh: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PartsEquipmentPage() {
  const { data: session } = useSession();
  const canManage = (session?.user as any)?.role === 'owner' ||
    !!(session?.user as any)?.permissions?.parts_equipment?.can_manage;

  const [orders, setOrders] = useState<POOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showFilter, setShowFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortCol, setSortCol] = useState('date_added');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Edit drawer
  const [selectedOrder, setSelectedOrder] = useState<POOrder | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eOwner, setEOwner] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eSupplier, setESupplier] = useState('');
  const [eOrderNum, setEOrderNum] = useState('');
  const [eCost, setECost] = useState('');
  const [eEta, setEEta] = useState('');
  const [eScheduled, setEScheduled] = useState('');
  const [eNotesWh, setENotesWh] = useState('');
  const [eNotesCxr, setENotesCxr] = useState('');
  const [eIsEquipment, setEIsEquipment] = useState(false);
  const [ePart, setEPart] = useState('');
  const [eBoNotified, setEBoNotified] = useState(false);
  const [eBoDate, setEBoDate] = useState('');
  const [eCancelSource, setECancelSource] = useState('');
  const [eCancelReason, setECancelReason] = useState('');
  const [eWarranty, setEWarranty] = useState('No');

  // Add drawer
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [add, setAdd] = useState(emptyAdd);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
      setLastSync(data.lastSync || null);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 60000);
    return () => clearInterval(t);
  }, [loadOrders]);

  // Open edit drawer
  const openOrder = (order: POOrder) => {
    setSelectedOrder(order);
    setEOwner(order.owner || '');
    setELocation(order.location || '');
    setESupplier(order.supplier || '');
    setEOrderNum(order.order_number || '');
    setECost(order.part_cost || '');
    setEEta(order.eta_date || '');
    setEScheduled(order.scheduled_date || '');
    setENotesWh(order.notes_warehouse || '');
    setENotesCxr(order.notes_cxr || '');
    setEIsEquipment(order.is_equipment || false);
    setEPart(order.part_description || '');
    setEBoNotified(order.bo_notified || false);
    setEBoDate(order.bo_notified_date || '');
    setECancelSource(order.cancel_source || '');
    setECancelReason(order.cancel_reason || '');
    setEWarranty(order.warranty || 'No');
    setEditModalOpen(true);
  };

  const handleLocationChange = (loc: string) => {
    setELocation(loc);
    const auto = ownerForLocation(loc, eIsEquipment);
    if (auto) setEOwner(auto);
  };

  const saveChanges = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${selectedOrder.job_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: eOwner, location: eLocation, supplier: eSupplier,
          order_number: eOrderNum, part_cost: eCost, part_description: ePart,
          is_equipment: eIsEquipment, eta_date: eEta || null,
          notes_warehouse: eNotesWh, notes_cxr: eNotesCxr,
          warranty: eWarranty, cancel_source: eCancelSource,
        }),
      });
      await loadOrders();
      setEditModalOpen(false);
    } finally { setSaving(false); }
  };

  const completeOrder = async () => {
    if (!selectedOrder || !eScheduled) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${selectedOrder.job_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: eScheduled, completed_by: session?.user?.name }),
      });
      await loadOrders();
      setEditModalOpen(false);
    } finally { setSaving(false); }
  };

  const cancelOrder = async () => {
    if (!selectedOrder || !eCancelSource) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${selectedOrder.job_id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_source: eCancelSource, cancel_reason: eCancelReason }),
      });
      await loadOrders();
      setEditModalOpen(false);
    } finally { setSaving(false); }
  };

  const confirmBoNotified = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${selectedOrder.job_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bo_notified: true,
          bo_notified_date: eBoDate || new Date().toISOString().split('T')[0],
          owner: 'Warehouse',
        }),
      });
      setEOwner('Warehouse');
      await loadOrders();
    } finally { setSaving(false); }
  };

  const addOrder = async () => {
    if (!add.job || !add.customer) return;
    setSaving(true);
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: add.job, customer_name: add.customer, technician: add.tech,
          job_type: add.type, date_added: add.date || undefined, owner: add.owner,
          location: add.location, supplier: add.supplier, order_number: add.orderNum,
          part_cost: add.cost, part_description: add.part, is_equipment: add.isEquipment,
          warranty: add.warranty, notes_warehouse: add.notesWh,
        }),
      });
      await loadOrders();
      setAddModalOpen(false);
      setAdd(emptyAdd);
    } finally { setSaving(false); }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try { await fetch('/api/cron/sync', { method: 'POST' }); await loadOrders(); } finally { setSyncing(false); }
  };

  // ─── Computed ──────────────────────────────────────────────────────────────

  const openOrders = useMemo(() => orders.filter(o => o.status === 'open'), [orders]);

  const stats = useMemo(() => ({
    all:        openOrders.length,
    placeOrder: openOrders.filter(o => o.location === 'Place Order').length,
    inTransit:  openOrders.filter(o => o.location === 'Shipping to Shop').length,
    backordered:openOrders.filter(o => o.location === 'Backordered').length,
    cxrReady:   openOrders.filter(o => o.location === 'Lewisville Shop').length,
    aging:      openOrders.filter(o => daysSince(o.date_added) > 30).length,
    completed:  orders.filter(o => o.status === 'completed').length,
  }), [openOrders, orders]);

  const ownerStats = useMemo(() =>
    OWNERS.reduce((acc, o) => ({ ...acc, [o]: openOrders.filter(ord => ord.owner === o).length }), {} as Record<string, number>),
    [openOrders]
  );

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter === 'completed-all') {
      result = result.filter(o => o.status !== 'open');
    } else if (showFilter === 'open') {
      result = result.filter(o => o.status === 'open');
    } else if (showFilter === 'completed') {
      result = result.filter(o => o.status !== 'open');
    }

    if (statusFilter === 'Place Order') result = result.filter(o => o.location === 'Place Order');
    else if (statusFilter === 'Shipping to Shop') result = result.filter(o => o.location === 'Shipping to Shop');
    else if (statusFilter === 'Backordered') result = result.filter(o => o.location === 'Backordered');
    else if (statusFilter === 'cxr-ready') result = result.filter(o => o.location === 'Lewisville Shop');
    else if (statusFilter === 'aging') result = result.filter(o => daysSince(o.date_added) > 30);

    if (ownerFilter) result = result.filter(o => o.owner === ownerFilter);
    if (typeFilter) result = result.filter(o => o.job_type === typeFilter);
    if (locationFilter) result = result.filter(o => o.location === locationFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.job_id.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.technician?.toLowerCase().includes(q) ||
        o.part_description?.toLowerCase().includes(q) ||
        o.supplier?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let av: string | null = null, bv: string | null = null;
      switch (sortCol) {
        case 'date_added':    av = a.date_added; bv = b.date_added; break;
        case 'job_id':        av = a.job_id; bv = b.job_id; break;
        case 'technician':    av = a.technician; bv = b.technician; break;
        case 'customer_name': av = a.customer_name; bv = b.customer_name; break;
        case 'location':      av = a.location; bv = b.location; break;
        case 'owner':         av = a.owner; bv = b.owner; break;
        case 'eta_date':      av = a.eta_date; bv = b.eta_date; break;
        case 'scheduled_date':av = a.scheduled_date; bv = b.scheduled_date; break;
        case 'age':           av = b.date_added; bv = a.date_added; break;
      }
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return result;
  }, [orders, showFilter, statusFilter, ownerFilter, typeFilter, locationFilter, searchQuery, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleStatFilter = (key: string) => {
    setStatusFilter(key);
    if (key === 'completed-all') setShowFilter('completed');
    else if (key !== 'all') setShowFilter('open');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
        Loading orders…
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const statCards = [
    { key: 'all',           label: 'All Open',      value: stats.all,        color: '#60a5fa' },
    { key: 'Place Order',   label: 'Place Order',   value: stats.placeOrder, color: '#fbbf24' },
    { key: 'Shipping to Shop', label: 'In Transit', value: stats.inTransit,  color: '#60a5fa' },
    { key: 'Backordered',   label: 'Backordered',   value: stats.backordered,color: '#f87171' },
    { key: 'cxr-ready',     label: 'CXR / Schedule',value: stats.cxrReady,  color: '#4ade80' },
    { key: 'aging',         label: 'Over 30 Days',  value: stats.aging,      color: '#f87171' },
    { key: 'completed-all', label: 'Completed',     value: stats.completed,  color: '#4ade80' },
  ];

  const tableCols: { key: string | null; label: string }[] = [
    { key: 'date_added',    label: 'Date' },
    { key: 'job_id',        label: 'Job #' },
    { key: 'technician',    label: 'Tech' },
    { key: 'customer_name', label: 'Customer' },
    { key: null,            label: 'Part / Equipment' },
    { key: 'location',      label: 'Location' },
    { key: 'owner',         label: 'Owner' },
    { key: null,            label: 'Wty' },
    { key: 'age',           label: 'Age' },
    { key: 'eta_date',      label: 'ETA' },
    { key: 'scheduled_date',label: 'Scheduled' },
    { key: null,            label: 'WH Notes' },
    { key: null,            label: 'CXR Notes' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--christmas-cream)' }}>Parts & Equipment</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Parts order tracking'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={triggerSync} disabled={syncing} style={{ fontSize: '0.8125rem' }}>
            {syncing ? 'Syncing…' : '↻ Sync ST'}
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
              + New Order
            </button>
          )}
        </div>
      </div>

      {/* Stat bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.625rem', marginBottom: '0.625rem' }}>
        {statCards.map(s => (
          <div
            key={s.key}
            className="card"
            onClick={() => handleStatFilter(s.key)}
            style={{
              padding: '0.875rem 1rem', cursor: 'pointer', transition: 'all 0.15s',
              borderColor: statusFilter === s.key ? s.color : 'var(--border-subtle)',
              boxShadow: statusFilter === s.key ? `0 0 0 1px ${s.color}40` : undefined,
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: '1.625rem', fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Owner bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
        {OWNERS.map(owner => {
          const os = getOwnerStyle(owner);
          const active = ownerFilter === owner;
          return (
            <div
              key={owner}
              onClick={() => setOwnerFilter(active ? '' : owner)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.875rem',
                borderRadius: '0.75rem', border: `1px solid ${active ? (os.color as string) : 'var(--border-subtle)'}`,
                background: 'var(--bg-card)', cursor: 'pointer', minWidth: 110,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: os.color as string, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--christmas-cream)', lineHeight: 1.2 }}>{owner}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.0625rem', fontWeight: 500, color: os.color as string, lineHeight: 1.1, marginTop: 1 }}>
                  {ownerStats[owner] || 0}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Aging banner */}
      {stats.aging > 0 && (
        <div style={{
          marginBottom: '0.5rem', background: 'rgba(214,59,59,0.07)',
          border: '1px solid rgba(214,59,59,0.22)', borderRadius: '0.5rem',
          padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8125rem',
        }}>
          <span style={{ background: '#d63b3b', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'monospace' }}>{stats.aging}</span>
          <span style={{ color: '#f87171', fontWeight: 500 }}>Orders over 30 days</span>
          <span style={{ color: 'var(--text-muted)' }}>— review notes or initiate Cancel PO</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.6875rem', padding: '4px 10px' }} onClick={() => handleStatFilter('aging')}>View all</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', padding: '0.625rem 0', marginBottom: '0.75rem', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="input" style={{ paddingLeft: 32, fontSize: '0.8125rem' }} type="text" placeholder="Search job, customer, tech, part…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto', fontSize: '0.8125rem' }} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', fontSize: '0.8125rem' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', fontSize: '0.8125rem' }} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
          <option value="">All locations</option>
          {LOCATIONS.filter(l => l !== 'Cancel PO').map(l => <option key={l}>{l}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', fontSize: '0.8125rem' }} value={showFilter} onChange={e => setShowFilter(e.target.value as any)}>
          <option value="open">Open orders</option>
          <option value="completed">Completed orders</option>
          <option value="all">All orders</option>
        </select>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {filteredOrders.length} rows
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <table className="pe-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              {tableCols.map(col => (
                <th key={col.label} onClick={col.key ? () => handleSort(col.key!) : undefined} style={{ cursor: col.key ? 'pointer' : 'default' }}>
                  {col.label}
                  {col.key && (
                    <span style={{ opacity: sortCol === col.key ? 1 : 0.3, marginLeft: 3, fontSize: '0.5rem' }}>
                      {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No orders match your filters.</td></tr>
            ) : filteredOrders.map(order => {
              const age = daysSince(order.date_added);
              return (
                <tr key={order.job_id} onClick={() => openOrder(order)} style={{ ...getRowStyle(order), cursor: 'pointer', opacity: order.status !== 'open' ? 0.6 : 1 }}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: age > 30 ? '#d63b3b' : age > 14 ? '#fbbf24' : '#4ade80' }} />
                      {formatDate(order.date_added)}
                    </div>
                  </td>
                  <td>
                    {order.st_url ? (
                      <a href={order.st_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#60a5fa', textDecoration: 'none', borderBottom: '1px dashed rgba(96,165,250,0.4)' }}>
                        {order.job_id}
                      </a>
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{order.job_id}</span>
                    )}
                  </td>
                  <td><span style={{ fontWeight: 500, fontSize: '0.75rem' }}>{order.technician || '—'}</span></td>
                  <td>
                    <div style={{ fontSize: '0.75rem' }}>{order.customer_name || '—'}</div>
                    {order.job_type && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>{order.job_type}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', maxWidth: 170, lineHeight: 1.4 }}>{order.part_description || '—'}</div>
                    {order.supplier && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{order.supplier}</div>}
                  </td>
                  <td>
                    {order.location && (
                      <span style={{ ...getLocationStyle(order.location), display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.6563rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                        {order.location}
                      </span>
                    )}
                  </td>
                  <td>
                    {order.owner && (
                      <span style={{ ...getOwnerStyle(order.owner), display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                        {order.owner}
                      </span>
                    )}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.6563rem', color: order.warranty && order.warranty !== 'No' ? '#fbbf24' : 'var(--text-muted)', fontWeight: order.warranty && order.warranty !== 'No' ? 500 : 400 }}>{order.warranty || 'No'}</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: age > 30 ? '#f87171' : age > 14 ? '#fbbf24' : 'var(--text-muted)', fontWeight: age > 30 ? 600 : 400, whiteSpace: 'nowrap' }}>{age}d</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{order.eta_date ? formatDate(order.eta_date) : '—'}</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: order.scheduled_date ? '#4ade80' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{order.scheduled_date ? formatDate(order.scheduled_date) : '—'}</span></td>
                  <td><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.notes_warehouse || '—'}</div></td>
                  <td><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.notes_cxr || '—'}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Edit Drawer ─────────────────────────────────────────────────── */}
      {editModalOpen && selectedOrder && (
        <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) setEditModalOpen(false); }}>
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--christmas-cream)' }}>{selectedOrder.customer_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                  Job #{selectedOrder.job_id}
                </div>
              </div>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.125rem', padding: 2 }}>✕</button>
            </div>

            {/* Read-only job info */}
            <div className="section-label">Job details</div>
            <div className="detail-grid" style={{ marginBottom: '1rem' }}>
              <div className="detail-item"><div className="detail-item-label">Technician</div><div className="detail-item-val">{selectedOrder.technician || '—'}</div></div>
              <div className="detail-item"><div className="detail-item-label">Type</div><div className="detail-item-val">{selectedOrder.job_type || '—'}</div></div>
              <div className="detail-item"><div className="detail-item-label">Date Added</div><div className="detail-item-val mono">{formatDate(selectedOrder.date_added)}</div></div>
              <div className="detail-item"><div className="detail-item-label">Age</div><div className="detail-item-val mono">{daysSince(selectedOrder.date_added)}d</div></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-item-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Part / Equipment
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <input type="checkbox" checked={eIsEquipment} onChange={e => { setEIsEquipment(e.target.checked); const auto = ownerForLocation(eLocation, e.target.checked); if (auto) setEOwner(auto); }} style={{ width: 14, height: 14, accentColor: 'var(--christmas-green)', cursor: 'pointer' }} />
                    Equipment order
                  </label>
                </div>
                <input className="input" type="text" value={ePart} onChange={e => setEPart(e.target.value)} placeholder="Part or equipment description" style={{ marginTop: 6, fontSize: '0.8125rem' }} />
              </div>
              <div className="detail-item"><div className="detail-item-label">Order #</div><div className="detail-item-val mono">{selectedOrder.order_number || '—'}</div></div>
              <div className="detail-item"><div className="detail-item-label">Cost</div><div className="detail-item-val mono">{selectedOrder.part_cost || '—'}</div></div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '1rem 0' }} />

            {/* Editable fields */}
            <div className="section-label">Update order</div>

            <div className="edit-row">
              <span className="edit-label">Owner</span>
              <select className="select input" value={eOwner} onChange={e => setEOwner(e.target.value)} style={{ flex: 1 }}>
                {OWNERS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="edit-row">
              <span className="edit-label">Location</span>
              <select className="select input" value={eLocation} onChange={e => handleLocationChange(e.target.value)} style={{ flex: 1 }}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="edit-row">
              <span className="edit-label">Supplier</span>
              <select className="select input" value={eSupplier} onChange={e => setESupplier(e.target.value)} style={{ flex: 1 }}>
                <option value="">— select —</option>
                {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="edit-row">
              <span className="edit-label">Order #</span>
              <input className="input" type="text" value={eOrderNum} onChange={e => setEOrderNum(e.target.value)} placeholder="DE015375" style={{ flex: 1 }} />
            </div>
            <div className="edit-row">
              <span className="edit-label">Cost</span>
              <input className="input" type="text" value={eCost} onChange={e => setECost(e.target.value)} placeholder="$0.00" style={{ flex: 1 }} />
            </div>
            <div className="edit-row">
              <span className="edit-label">Warranty</span>
              <select className="select input" value={eWarranty} onChange={e => setEWarranty(e.target.value)} style={{ flex: 1 }}>
                {WARRANTIES.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div className="edit-row">
              <span className="edit-label">ETA</span>
              <input className="input" type="date" value={eEta} onChange={e => setEEta(e.target.value)} style={{ flex: 1 }} />
            </div>

            <div style={{ marginBottom: '0.625rem' }}>
              <div className="section-label" style={{ marginBottom: '0.3125rem' }}>Notes from Warehouse</div>
              <textarea className="input" value={eNotesWh} onChange={e => setENotesWh(e.target.value)} placeholder="Warehouse internal notes…" />
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <div className="section-label" style={{ marginBottom: '0.3125rem' }}>Notes from CXR</div>
              <textarea className="input" value={eNotesCxr} onChange={e => setENotesCxr(e.target.value)} placeholder="Customer contact attempts, scheduling notes…" />
            </div>

            {/* Backorder section */}
            {eLocation === 'Backordered' && (
              <div className="workflow-box workflow-box-amber" style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Backorder — customer notification</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.6 }}>CXR must notify the customer and confirm before ticket returns to Warehouse.</p>
                <div className="check-row">
                  <input type="checkbox" id="chk-bo" checked={eBoNotified} onChange={e => setEBoNotified(e.target.checked)} />
                  <label htmlFor="chk-bo" style={{ cursor: 'pointer' }}>Customer notified of backorder</label>
                </div>
                {eBoNotified && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.625rem' }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>Date customer notified</div>
                    <input className="input" type="date" value={eBoDate} onChange={e => setEBoDate(e.target.value)} />
                  </div>
                )}
                <button className="btn btn-success" style={{ width: '100%', marginTop: '0.5rem' }} disabled={!eBoNotified || saving} onClick={confirmBoNotified}>
                  Confirm & return to Warehouse
                </button>
              </div>
            )}

            {/* Close out section */}
            {selectedOrder.status === 'open' && (
              <div className="workflow-box workflow-box-green" style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4ade80', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Close out</div>
                <div style={{ marginBottom: '0.625rem' }}>
                  <div className="section-label" style={{ marginBottom: 4 }}>Scheduled date</div>
                  <input className="input" type="date" value={eScheduled} onChange={e => setEScheduled(e.target.value)} />
                  {eScheduled && <p style={{ fontSize: '0.6875rem', color: '#4ade80', marginTop: 4, lineHeight: 1.5 }}>Row will move to completed once saved.</p>}
                </div>
                <button className="btn btn-success" style={{ width: '100%', padding: '0.5625rem' }} disabled={!eScheduled || saving} onClick={completeOrder}>
                  Mark complete & move to Parts Completed
                </button>
              </div>
            )}

            {/* Cancel PO section */}
            {selectedOrder.status === 'open' && (
              <div className="workflow-box workflow-box-red" style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cancel PO</div>
                <div className="section-label" style={{ marginBottom: '0.3125rem', color: '#f87171' }}>Step 1 — CXR / Customer reason</div>
                <select className="select input" value={eCancelSource} onChange={e => setECancelSource(e.target.value)} style={{ marginBottom: '0.5rem' }}>
                  <option value="">Who is requesting the cancel?</option>
                  {CANCEL_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
                <textarea className="input" value={eCancelReason} onChange={e => setECancelReason(e.target.value)} placeholder="Additional detail…" style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.625rem', lineHeight: 1.5 }}>Remember: cancel the estimate in ServiceTitan so it clears the Follow Up section.</p>
                <button className="btn btn-danger" style={{ width: '100%', padding: '0.5625rem' }} disabled={!eCancelSource || saving} onClick={cancelOrder}>
                  Archive row & move to cancelled
                </button>
              </div>
            )}

            {/* Save bar */}
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-subtle)', marginTop: '1rem' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '0.5625rem' }} onClick={saveChanges} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {selectedOrder.st_url && (
                <a href={selectedOrder.st_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.5625rem 0.875rem', textDecoration: 'none' }}>
                  ST ↗
                </a>
              )}
              <button className="btn btn-secondary" style={{ padding: '0.5625rem 0.875rem' }} onClick={() => setEditModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Order Drawer ────────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) setAddModalOpen(false); }}>
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--christmas-cream)' }}>New parts order</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>Add from Dispatch Pro queue</div>
              </div>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.125rem', padding: 2 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Date</div>
                <input className="input" type="date" value={add.date} onChange={e => setAdd(a => ({ ...a, date: e.target.value }))} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Job # (PO)</div>
                <input className="input" type="text" placeholder="179247769" value={add.job} onChange={e => setAdd(a => ({ ...a, job: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Technician</div>
                <select className="select input" value={add.tech} onChange={e => setAdd(a => ({ ...a, tech: e.target.value }))}>
                  <option value="">Select tech</option>
                  {TECHS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Type</div>
                <select className="select input" value={add.type} onChange={e => setAdd(a => ({ ...a, type: e.target.value }))}>
                  {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Customer name</div>
              <input className="input" type="text" placeholder="John Smith" value={add.customer} onChange={e => setAdd(a => ({ ...a, customer: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Owner</div>
                <select className="select input" value={add.owner} onChange={e => setAdd(a => ({ ...a, owner: e.target.value }))}>
                  {OWNERS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Warranty</div>
                <select className="select input" value={add.warranty} onChange={e => setAdd(a => ({ ...a, warranty: e.target.value }))}>
                  {WARRANTIES.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '0.625rem' }}>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                Part / Equipment
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={add.isEquipment} onChange={e => setAdd(a => ({ ...a, isEquipment: e.target.checked }))} style={{ width: 14, height: 14, accentColor: 'var(--christmas-green)', cursor: 'pointer' }} />
                  Equipment order
                </label>
              </div>
              <input className="input" type="text" placeholder="Blower Motor Trane 29139913" value={add.part} onChange={e => setAdd(a => ({ ...a, part: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Supplier</div>
                <select className="select input" value={add.supplier} onChange={e => setAdd(a => ({ ...a, supplier: e.target.value }))}>
                  <option value="">— select —</option>
                  {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Location</div>
                <select className="select input" value={add.location} onChange={e => setAdd(a => ({ ...a, location: e.target.value, owner: ownerForLocation(e.target.value, a.isEquipment) || a.owner }))}>
                  {LOCATIONS.filter(l => l !== 'Cancel PO').map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Order #</div>
                <input className="input" type="text" placeholder="DE015375" value={add.orderNum} onChange={e => setAdd(a => ({ ...a, orderNum: e.target.value }))} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Part cost</div>
                <input className="input" type="text" placeholder="$0.00" value={add.cost} onChange={e => setAdd(a => ({ ...a, cost: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Notes from Warehouse</div>
              <textarea className="input" placeholder="Internal notes…" value={add.notesWh} onChange={e => setAdd(a => ({ ...a, notesWh: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '0.5625rem' }} onClick={addOrder} disabled={!add.job || !add.customer || saving}>
                {saving ? 'Adding…' : 'Add order'}
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.5625rem 0.875rem' }} onClick={() => { setAddModalOpen(false); setAdd(emptyAdd); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
