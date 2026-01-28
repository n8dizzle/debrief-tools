'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { ARCustomer } from '@/lib/supabase';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<ARCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/customers', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase()) ||
           c.email?.toLowerCase().includes(search.toLowerCase()) ||
           c.phone?.includes(search);
  });

  const totalOutstanding = filteredCustomers.reduce((sum, c) => sum + Number(c.total_outstanding), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Customers
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filteredCustomers.length} customers · {formatCurrency(totalOutstanding)} outstanding
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          className="input"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Customer List */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Outstanding</th>
                <th>Invoices</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Next Followup</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td>
                      <div className="text-sm">
                        {customer.email && (
                          <div style={{ color: 'var(--text-secondary)' }}>{customer.email}</div>
                        )}
                        {customer.phone && (
                          <div style={{ color: 'var(--text-muted)' }}>{customer.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="font-medium" style={{ color: 'var(--status-error)' }}>
                      {formatCurrency(customer.total_outstanding)}
                    </td>
                    <td>{customer.invoice_count}</td>
                    <td>
                      <span className={`badge badge-${customer.collection_priority === 'critical' ? '90' : customer.collection_priority === 'high' ? '60' : 'current'}`}>
                        {customer.collection_priority}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {customer.collection_status}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {customer.next_followup_date ? formatDate(customer.next_followup_date) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
