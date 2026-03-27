'use client';

import { useState, useEffect, useCallback } from 'react';

type TabKey = 'pending' | 'active' | 'completed' | 'all';

interface OrderItem {
  id: string;
  order_id: string;
  service_id: string;
  status: string;
  price_snapshot: number | null;
  contractor_payout: number | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  completed_at: string | null;
  catalog_services: {
    id: string;
    name: string;
    description: string;
    pricing_type: string;
  } | null;
  orders: {
    id: string;
    order_number: string;
    status: string;
    total: number;
    scheduled_date: string | null;
    created_at: string;
    user_profiles: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string;
    } | null;
    homes: {
      id: string;
      address_line1: string;
      city: string;
      state: string;
      zip_code: string;
    } | null;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  assigned: 'badge-warning',
  confirmed: 'badge-info',
  scheduled: 'badge-info',
  in_progress: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const fetchOrders = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? '' : `?status=${tab}`;
      const res = await fetch(`/api/orders${statusParam}`);
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrderItems(data.order_items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

  async function handleAction(orderItemId: string, action: string) {
    setActionLoading(orderItemId);
    try {
      const res = await fetch(`/api/orders/${orderItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      // Refresh the list
      await fetchOrders(activeTab);
      setSelectedOrder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 0.25rem',
          }}
        >
          Orders
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Manage your service orders and track progress.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          borderBottom: '1px solid var(--border-default)',
          marginBottom: '1.5rem',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--hw-blue)' : 'transparent'}`,
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--status-error)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading orders...</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Address</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Payout</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item) => (
                <tr
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedOrder(item)}
                >
                  <td>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.orders?.order_number || '--'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>
                    {item.catalog_services?.name || '--'}
                  </td>
                  <td>{item.orders?.user_profiles?.full_name || '--'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {item.orders?.homes
                      ? `${item.orders.homes.address_line1}, ${item.orders.homes.city}`
                      : '--'}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {formatDate(item.scheduled_date)}
                      </div>
                      {item.scheduled_time_start && (
                        <div style={{ color: 'var(--text-muted)' }}>
                          {item.scheduled_time_start}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusColors[item.status] || 'badge-info'}`}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.contractor_payout ? formatCents(item.contractor_payout) : '--'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {(item.status === 'pending' || item.status === 'assigned') && (
                      <button
                        className="btn-primary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleAction(item.id, 'confirm')}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? '...' : 'Confirm'}
                      </button>
                    )}
                    {(item.status === 'confirmed' || item.status === 'scheduled') && (
                      <button
                        className="btn-primary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleAction(item.id, 'start')}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? '...' : 'Start'}
                      </button>
                    )}
                    {item.status === 'in_progress' && (
                      <button
                        className="btn-primary"
                        style={{
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.75rem',
                          background: 'var(--status-success)',
                        }}
                        onClick={() => handleAction(item.id, 'complete')}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? '...' : 'Complete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orderItems.length === 0 && (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}
            >
              No {activeTab === 'all' ? '' : activeTab} orders found.
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
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
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div
            className="card"
            style={{ width: '560px', maxWidth: '90vw', padding: '2rem', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                  Order {selectedOrder.orders?.order_number || '--'}
                </h3>
                <span className={`badge ${statusColors[selectedOrder.status] || 'badge-info'}`}>
                  {statusLabels[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Service */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Service
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {selectedOrder.catalog_services?.name || '--'}
              </div>
              {selectedOrder.catalog_services?.description && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {selectedOrder.catalog_services.description}
                </div>
              )}
            </div>

            {/* Customer */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Customer
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {selectedOrder.orders?.user_profiles?.full_name || '--'}
              </div>
              {selectedOrder.orders?.user_profiles?.phone && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {selectedOrder.orders.user_profiles.phone}
                </div>
              )}
            </div>

            {/* Address */}
            {selectedOrder.orders?.homes && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Address
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {selectedOrder.orders.homes.address_line1}
                  <br />
                  {selectedOrder.orders.homes.city}, {selectedOrder.orders.homes.state} {selectedOrder.orders.homes.zip_code}
                </div>
              </div>
            )}

            {/* Schedule */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Scheduled
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {selectedOrder.scheduled_date
                  ? new Date(selectedOrder.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Not scheduled'}
                {selectedOrder.scheduled_time_start && (
                  <span style={{ color: 'var(--text-muted)' }}> at {selectedOrder.scheduled_time_start}</span>
                )}
              </div>
            </div>

            {/* Payout */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Payout
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-success)' }}>
                {selectedOrder.contractor_payout ? formatCents(selectedOrder.contractor_payout) : '--'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem' }}>
              {(selectedOrder.status === 'pending' || selectedOrder.status === 'assigned') && (
                <button
                  className="btn-primary"
                  onClick={() => handleAction(selectedOrder.id, 'confirm')}
                  disabled={actionLoading === selectedOrder.id}
                >
                  {actionLoading === selectedOrder.id ? 'Confirming...' : 'Confirm Order'}
                </button>
              )}
              {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'scheduled') && (
                <button
                  className="btn-primary"
                  onClick={() => handleAction(selectedOrder.id, 'start')}
                  disabled={actionLoading === selectedOrder.id}
                >
                  {actionLoading === selectedOrder.id ? 'Starting...' : 'Start Work'}
                </button>
              )}
              {selectedOrder.status === 'in_progress' && (
                <button
                  className="btn-primary"
                  style={{ background: 'var(--status-success)' }}
                  onClick={() => handleAction(selectedOrder.id, 'complete')}
                  disabled={actionLoading === selectedOrder.id}
                >
                  {actionLoading === selectedOrder.id ? 'Completing...' : 'Mark Complete'}
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
