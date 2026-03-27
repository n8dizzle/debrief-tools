'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface SupplierList {
  id: string;
  supplier_name: string;
  file_name: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  item_count: number;
  mapped_count: number;
  created_at: string;
}

interface SupplierItem {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  supplier_cost: number; // cents
  markup_percent: number;
  retail_price: number; // cents
  mapping_status: 'unmapped' | 'suggested' | 'confirmed';
  mapped_service_name: string | null;
  mapped_service_id: string | null;
  mapping_confidence: number | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: SupplierList['status'] }) {
  const config: Record<
    SupplierList['status'],
    { className: string; label: string; showSpinner: boolean }
  > = {
    pending: { className: 'badge', label: 'Pending', showSpinner: false },
    processing: { className: 'badge badge-warning', label: 'Processing', showSpinner: true },
    completed: { className: 'badge badge-success', label: 'Completed', showSpinner: false },
    failed: { className: 'badge badge-error', label: 'Failed', showSpinner: false },
  };

  const { className, label, showSpinner } = config[status];

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
      {showSpinner && (
        <span
          style={{
            width: '10px',
            height: '10px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let className = 'badge';
  if (confidence >= 80) className = 'badge badge-success';
  else if (confidence >= 50) className = 'badge badge-warning';
  else className = 'badge badge-error';

  return <span className={className}>{confidence}%</span>;
}

const ITEMS_PER_PAGE = 20;

export default function SupplierListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;

  const [list, setList] = useState<SupplierList | null>(null);
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingMarkupId, setEditingMarkupId] = useState<string | null>(null);
  const [editingMarkupValue, setEditingMarkupValue] = useState('');
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState('');

  // Bulk markup modal
  const [showBulkMarkup, setShowBulkMarkup] = useState(false);
  const [bulkMarkupValue, setBulkMarkupValue] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Action states
  const [parsing, setParsing] = useState(false);
  const [mapping, setMapping] = useState(false);

  // Catalog search for mapping
  const [showMapDropdown, setShowMapDropdown] = useState<string | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<Array<{ id: string; name: string }>>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const mapDropdownRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/pricebook/lists/${listId}`);
      if (!res.ok) throw new Error('Failed to load supplier list');
      const data = await res.json();
      setList(data.list);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Poll while processing
  useEffect(() => {
    if (!list || list.status !== 'processing') return;
    const interval = setInterval(fetchDetail, 3000);
    return () => clearInterval(interval);
  }, [list, fetchDetail]);

  // Close map dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mapDropdownRef.current && !mapDropdownRef.current.contains(e.target as Node)) {
        setShowMapDropdown(null);
        setMapSearchQuery('');
        setCatalogResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Catalog search debounce
  useEffect(() => {
    if (!mapSearchQuery.trim() || !showMapDropdown) {
      setCatalogResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingCatalog(true);
      try {
        const res = await fetch(`/api/catalog?search=${encodeURIComponent(mapSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setCatalogResults(
            (data.services || []).slice(0, 10).map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            }))
          );
        }
      } catch {
        // ignore search errors
      } finally {
        setSearchingCatalog(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [mapSearchQuery, showMapDropdown]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Summary stats
  const totalRetailValue = items.reduce((sum, item) => sum + item.retail_price, 0);
  const avgMarkup =
    items.length > 0
      ? (items.reduce((sum, item) => sum + item.markup_percent, 0) / items.length).toFixed(1)
      : '0';

  // Selection
  const allPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id));

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Inline edit - Markup
  async function saveMarkup(itemId: string) {
    const value = parseFloat(editingMarkupValue);
    if (isNaN(value) || value < 0) return;

    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const newRetail = Math.round(item.supplier_cost * (1 + value / 100));
      const res = await fetch(`/api/pricebook/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markup_percent: value, retail_price: newRetail }),
      });
      if (!res.ok) throw new Error('Failed to update');

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, markup_percent: value, retail_price: newRetail } : i
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditingMarkupId(null);
      setEditingMarkupValue('');
    }
  }

  // Inline edit - Cost
  async function saveCost(itemId: string) {
    const dollars = parseFloat(editingCostValue);
    if (isNaN(dollars) || dollars < 0) return;

    const cents = Math.round(dollars * 100);
    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const newRetail = Math.round(cents * (1 + item.markup_percent / 100));
      const res = await fetch(`/api/pricebook/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_cost: cents, retail_price: newRetail }),
      });
      if (!res.ok) throw new Error('Failed to update');

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, supplier_cost: cents, retail_price: newRetail } : i
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditingCostId(null);
      setEditingCostValue('');
    }
  }

  // Bulk markup
  async function applyBulkMarkup() {
    const value = parseFloat(bulkMarkupValue);
    if (isNaN(value) || value < 0) return;

    setBulkSaving(true);
    try {
      const targetItems = selectedIds.size > 0
        ? items.filter((i) => selectedIds.has(i.id))
        : items;

      const updates = targetItems.map((item) => ({
        id: item.id,
        markup_percent: value,
        retail_price: Math.round(item.supplier_cost * (1 + value / 100)),
      }));

      const res = await fetch('/api/pricebook/items/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error('Failed to apply bulk markup');

      // Update local state
      const updateMap = new Map(updates.map((u) => [u.id, u]));
      setItems((prev) =>
        prev.map((i) => {
          const update = updateMap.get(i.id);
          if (update) {
            return { ...i, markup_percent: update.markup_percent, retail_price: update.retail_price };
          }
          return i;
        })
      );

      setShowBulkMarkup(false);
      setBulkMarkupValue('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setBulkSaving(false);
    }
  }

  // Re-parse
  async function handleReparse() {
    if (!confirm('Re-parse this list? This will replace all current items.')) return;
    setParsing(true);
    try {
      const res = await fetch(`/api/pricebook/lists/${listId}/parse`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start parsing');
      fetchDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to re-parse');
    } finally {
      setParsing(false);
    }
  }

  // Auto-map
  async function handleAutoMap() {
    setMapping(true);
    try {
      const res = await fetch(`/api/pricebook/lists/${listId}/map`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start mapping');
      // Mapping may be async; refetch after a delay
      setTimeout(fetchDetail, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to map');
    } finally {
      setMapping(false);
    }
  }

  // Export CSV
  async function handleExport() {
    try {
      const res = await fetch(`/api/pricebook/lists/${listId}/export`);
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${list?.supplier_name || 'supplier'}-pricelist.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export');
    }
  }

  // Delete item
  async function handleDeleteItem(itemId: string) {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/pricebook/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  // Accept mapping suggestion
  async function handleAcceptMapping(itemId: string) {
    try {
      const res = await fetch(`/api/pricebook/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping_status: 'confirmed' }),
      });
      if (!res.ok) throw new Error('Failed to confirm mapping');
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, mapping_status: 'confirmed' } : i))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to confirm');
    }
  }

  // Reject mapping suggestion
  async function handleRejectMapping(itemId: string) {
    try {
      const res = await fetch(`/api/pricebook/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping_status: 'unmapped', mapped_service_id: null, mapped_service_name: null, mapping_confidence: null }),
      });
      if (!res.ok) throw new Error('Failed to reject mapping');
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, mapping_status: 'unmapped', mapped_service_id: null, mapped_service_name: null, mapping_confidence: null }
            : i
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  // Confirm manual mapping from catalog search
  async function handleManualMap(itemId: string, serviceId: string, serviceName: string) {
    try {
      const res = await fetch(`/api/pricebook/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping_status: 'confirmed',
          mapped_service_id: serviceId,
          mapped_service_name: serviceName,
          mapping_confidence: 100,
        }),
      });
      if (!res.ok) throw new Error('Failed to map');
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                mapping_status: 'confirmed',
                mapped_service_id: serviceId,
                mapped_service_name: serviceName,
                mapping_confidence: 100,
              }
            : i
        )
      );
      setShowMapDropdown(null);
      setMapSearchQuery('');
      setCatalogResults([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to map');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading list details...</div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ color: 'var(--status-error)', marginBottom: '0.5rem' }}>{error || 'List not found'}</div>
        <button className="btn-secondary" onClick={() => router.push('/pricebook/supplier-lists')}>
          Back to Lists
        </button>
      </div>
    );
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back Link */}
      <Link
        href="/pricebook/supplier-lists"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          fontSize: '0.8125rem',
          marginBottom: '1rem',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Supplier Lists
      </Link>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {list.supplier_name}
            </h1>
            <StatusBadge status={list.status} />
          </div>
          {list.file_name && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
              {list.file_name}
            </p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Total Items
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {items.length}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Average Markup
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {avgMarkup}%
          </div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Total Retail Value
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatCents(totalRetailValue)}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {(list.status === 'completed' || list.status === 'failed') && (
          <button
            className="btn-secondary"
            onClick={handleReparse}
            disabled={parsing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {parsing ? (
              <>
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid var(--border-default)',
                    borderTopColor: 'var(--text-secondary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Re-parsing...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Re-parse
              </>
            )}
          </button>
        )}

        {items.length > 0 && (
          <>
            <button
              className="btn-secondary"
              onClick={handleAutoMap}
              disabled={mapping}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {mapping ? (
                <>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid var(--border-default)',
                      borderTopColor: 'var(--text-secondary)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                  Mapping...
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.122a4.5 4.5 0 00-6.364-6.364L4.5 6.249a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Auto-Map to Catalog
                </>
              )}
            </button>

            <button
              className="btn-secondary"
              onClick={() => setShowBulkMarkup(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              Set Bulk Markup
              {selectedIds.size > 0 && (
                <span className="badge" style={{ marginLeft: '0.25rem' }}>
                  {selectedIds.size} selected
                </span>
              )}
            </button>

            <button
              className="btn-primary"
              onClick={handleExport}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
          </>
        )}
      </div>

      {/* Processing State */}
      {list.status === 'processing' && (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            AI is parsing your price list...
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            This usually takes 30-60 seconds. The page will update automatically.
          </div>
        </div>
      )}

      {/* Items Table */}
      {items.length === 0 && list.status !== 'processing' ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {list.status === 'pending'
              ? 'No items yet. Upload a file to get started.'
              : list.status === 'failed'
              ? 'Parsing failed. Try re-parsing or uploading a different file.'
              : 'No items found in this list.'}
          </div>
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem',
                minWidth: '900px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                    background: 'var(--bg-input)',
                  }}
                >
                  <th style={{ padding: '0.75rem 0.75rem', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  {['Part #', 'Description', 'Category', 'Supplier Cost', 'Markup %', 'Retail Price', 'Catalog Mapping', 'Actions'].map(
                    (header) => (
                      <th
                        key={header}
                        style={{
                          padding: '0.75rem 0.75rem',
                          textAlign: 'left',
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-default)',
                      background: selectedIds.has(item.id) ? 'rgba(59, 155, 143, 0.05)' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Part # */}
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {item.part_number || '--'}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-primary)', maxWidth: '250px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>
                      {item.category || '--'}
                    </td>

                    {/* Supplier Cost (editable) */}
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      {editingCostId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>$</span>
                          <input
                            type="number"
                            className="input"
                            value={editingCostValue}
                            onChange={(e) => setEditingCostValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveCost(item.id);
                              if (e.key === 'Escape') {
                                setEditingCostId(null);
                                setEditingCostValue('');
                              }
                            }}
                            onBlur={() => saveCost(item.id)}
                            step="0.01"
                            min="0"
                            autoFocus
                            style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                          />
                        </div>
                      ) : (
                        <span
                          onClick={() => {
                            setEditingCostId(item.id);
                            setEditingCostValue(String(item.supplier_cost / 100));
                          }}
                          style={{
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Click to edit"
                        >
                          {formatCents(item.supplier_cost)}
                        </span>
                      )}
                    </td>

                    {/* Markup % (editable) */}
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      {editingMarkupId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="number"
                            className="input"
                            value={editingMarkupValue}
                            onChange={(e) => setEditingMarkupValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveMarkup(item.id);
                              if (e.key === 'Escape') {
                                setEditingMarkupId(null);
                                setEditingMarkupValue('');
                              }
                            }}
                            onBlur={() => saveMarkup(item.id)}
                            step="0.1"
                            min="0"
                            autoFocus
                            style={{ width: '60px', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>%</span>
                        </div>
                      ) : (
                        <span
                          onClick={() => {
                            setEditingMarkupId(item.id);
                            setEditingMarkupValue(String(item.markup_percent));
                          }}
                          style={{
                            cursor: 'pointer',
                            color: 'var(--hw-blue)',
                            fontWeight: 500,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Click to edit"
                        >
                          {item.markup_percent}%
                        </span>
                      )}
                    </td>

                    {/* Retail Price */}
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: 'var(--status-success)' }}>
                      {formatCents(item.retail_price)}
                    </td>

                    {/* Catalog Mapping */}
                    <td style={{ padding: '0.625rem 0.75rem', position: 'relative' }}>
                      {item.mapping_status === 'confirmed' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            color: 'var(--status-success)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.mapped_service_name}
                          </span>
                        </span>
                      ) : item.mapping_status === 'suggested' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--text-secondary)',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.mapped_service_name}
                          </span>
                          {item.mapping_confidence != null && (
                            <ConfidenceBadge confidence={item.mapping_confidence} />
                          )}
                          <button
                            onClick={() => handleAcceptMapping(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--status-success)',
                              padding: '0.125rem',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Accept"
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRejectMapping(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--status-error)',
                              padding: '0.125rem',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Reject"
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }} ref={showMapDropdown === item.id ? mapDropdownRef : undefined}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setShowMapDropdown(showMapDropdown === item.id ? null : item.id);
                              setMapSearchQuery('');
                              setCatalogResults([]);
                            }}
                          >
                            Map
                          </button>
                          {showMapDropdown === item.id && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '0.25rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.3))',
                                width: '280px',
                                zIndex: 60,
                                padding: '0.5rem',
                              }}
                            >
                              <input
                                type="text"
                                className="input"
                                placeholder="Search catalog services..."
                                value={mapSearchQuery}
                                onChange={(e) => setMapSearchQuery(e.target.value)}
                                autoFocus
                                style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}
                              />
                              {searchingCatalog ? (
                                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                  Searching...
                                </div>
                              ) : catalogResults.length > 0 ? (
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                  {catalogResults.map((result) => (
                                    <button
                                      key={result.id}
                                      onClick={() => handleManualMap(item.id, result.id, result.name)}
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem 0.625rem',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-primary)',
                                        borderRadius: '4px',
                                        transition: 'background 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                    >
                                      {result.name}
                                    </button>
                                  ))}
                                </div>
                              ) : mapSearchQuery.trim() ? (
                                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                  No services found
                                </div>
                              ) : (
                                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                  Type to search catalog
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '0.25rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Delete item"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem',
                padding: '0 0.25rem',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of {items.length} items
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    // Show first, last, and pages near current
                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  })
                  .map((page, idx, arr) => {
                    const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                    return (
                      <span key={page} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {showEllipsis && (
                          <span style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}>...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          style={{
                            padding: '0.375rem 0.625rem',
                            fontSize: '0.8125rem',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: page === currentPage ? 'var(--hw-blue)' : 'var(--border-default)',
                            background: page === currentPage ? 'var(--hw-blue)' : 'transparent',
                            color: page === currentPage ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: page === currentPage ? 600 : 400,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {page}
                        </button>
                      </span>
                    );
                  })}
                <button
                  className="btn-secondary"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Bulk Markup Modal */}
      {showBulkMarkup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkSaving) {
              setShowBulkMarkup(false);
              setBulkMarkupValue('');
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '440px',
              maxWidth: '90vw',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 0.5rem',
              }}
            >
              Set Bulk Markup
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              {selectedIds.size > 0
                ? `Apply markup to ${selectedIds.size} selected item${selectedIds.size === 1 ? '' : 's'}.`
                : `Apply markup to all ${items.length} items.`}
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Markup Percentage
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 50"
                  value={bulkMarkupValue}
                  onChange={(e) => setBulkMarkupValue(e.target.value)}
                  step="0.1"
                  min="0"
                  autoFocus
                  style={{ paddingRight: '2rem' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  %
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowBulkMarkup(false);
                  setBulkMarkupValue('');
                }}
                disabled={bulkSaving}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={applyBulkMarkup}
                disabled={bulkSaving || !bulkMarkupValue || parseFloat(bulkMarkupValue) < 0}
              >
                {bulkSaving ? 'Applying...' : 'Apply Markup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
