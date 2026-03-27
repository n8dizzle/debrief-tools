'use client';

import { useState } from 'react';

type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  serviceName: string;
  contractor: string;
  amount: number;
  status: OrderStatus;
  scheduledDate: string;
  market: string;
}

const orders: Order[] = [
  { id: '1', orderNumber: '#1284', customerName: 'Jennifer Walsh', serviceName: 'Gutter Cleaning', contractor: 'Crystal Clear Windows', amount: 175, status: 'completed', scheduledDate: '2026-02-12', market: 'Austin' },
  { id: '2', orderNumber: '#1283', customerName: 'Robert Kim', serviceName: 'Lawn Mowing + Edging', contractor: 'Green Thumb Landscaping', amount: 65, status: 'in_progress', scheduledDate: '2026-02-12', market: 'Round Rock' },
  { id: '3', orderNumber: '#1282', customerName: 'Maria Garcia', serviceName: 'Pressure Washing - Driveway', contractor: 'Elite Pressure Washing LLC', amount: 225, status: 'confirmed', scheduledDate: '2026-02-13', market: 'Austin' },
  { id: '4', orderNumber: '#1281', customerName: 'David Thompson', serviceName: 'Deep House Cleaning', contractor: 'QuickClean Services', amount: 320, status: 'confirmed', scheduledDate: '2026-02-13', market: 'Austin' },
  { id: '5', orderNumber: '#1280', customerName: 'Lisa Anderson', serviceName: 'Interior Painting - Room', contractor: 'AllStar Handyman', amount: 450, status: 'pending', scheduledDate: '2026-02-14', market: 'Cedar Park' },
  { id: '6', orderNumber: '#1279', customerName: 'James Wilson', serviceName: 'Smart Thermostat Install', contractor: 'Hill Country Electrical', amount: 189, status: 'completed', scheduledDate: '2026-02-11', market: 'Austin' },
  { id: '7', orderNumber: '#1278', customerName: 'Sarah Mitchell', serviceName: 'Leaf Cleanup', contractor: 'Green Thumb Landscaping', amount: 95, status: 'completed', scheduledDate: '2026-02-11', market: 'Austin' },
  { id: '8', orderNumber: '#1277', customerName: 'Chris Brown', serviceName: 'Holiday Lighting - Premium', contractor: 'Green Thumb Landscaping', amount: 650, status: 'completed', scheduledDate: '2026-02-10', market: 'Round Rock' },
  { id: '9', orderNumber: '#1276', customerName: 'Amanda Davis', serviceName: 'Window Cleaning (Exterior)', contractor: 'Crystal Clear Windows', amount: 210, status: 'disputed', scheduledDate: '2026-02-09', market: 'Austin' },
  { id: '10', orderNumber: '#1275', customerName: 'Michael Lee', serviceName: 'Fence Installation - Wood', contractor: 'Budget Fence Co', amount: 2800, status: 'cancelled', scheduledDate: '2026-02-08', market: 'Pflugerville' },
];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.contractor.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusBadge = (status: OrderStatus) => {
    const map: Record<OrderStatus, { className: string; label: string }> = {
      pending: { className: 'badge-yellow', label: 'Pending' },
      confirmed: { className: 'badge-blue', label: 'Confirmed' },
      in_progress: { className: 'badge-purple', label: 'In Progress' },
      completed: { className: 'badge-green', label: 'Completed' },
      cancelled: { className: 'badge-gray', label: 'Cancelled' },
      disputed: { className: 'badge-red', label: 'Disputed' },
    };
    const s = map[status];
    return <span className={`badge ${s.className}`}>{s.label}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Orders</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            All marketplace orders
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: orders.length, color: '' },
          { label: 'Pending', value: orders.filter((o) => o.status === 'pending').length, color: 'text-yellow-400' },
          { label: 'In Progress', value: orders.filter((o) => o.status === 'in_progress' || o.status === 'confirmed').length, color: 'text-blue-400' },
          { label: 'Completed', value: orders.filter((o) => o.status === 'completed').length, color: 'text-green-400' },
          { label: 'Disputed', value: orders.filter((o) => o.status === 'disputed').length, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="admin-card py-3">
            <p className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color || 'text-[var(--admin-text)]'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="disputed">Disputed</option>
        </select>
        <span className="text-sm text-[var(--admin-text-muted)] ml-auto">
          {filtered.length} orders
        </span>
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Contractor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th>Market</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium text-[var(--admin-text)]">{o.orderNumber}</td>
                  <td>{o.customerName}</td>
                  <td>{o.serviceName}</td>
                  <td className="text-xs">{o.contractor}</td>
                  <td className="font-medium text-[var(--admin-text)]">${o.amount.toLocaleString()}</td>
                  <td>{statusBadge(o.status)}</td>
                  <td className="text-xs">{o.scheduledDate}</td>
                  <td><span className="badge badge-gray">{o.market}</span></td>
                  <td>
                    <button className="text-xs text-primary hover:text-primary-light transition-colors">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
