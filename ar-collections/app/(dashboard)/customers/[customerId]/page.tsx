'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { ARCustomerWithDetails } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<ARCustomerWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'notes'>('invoices');

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  async function fetchCustomer() {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch customer');
      const data = await response.json();
      setCustomer(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading customer...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          Customer not found
        </div>
        <div className="mt-4 text-center">
          <button onClick={() => router.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {customer.name}
            </h1>
            <div className="flex gap-4 mt-1" style={{ color: 'var(--text-secondary)' }}>
              {customer.email && <span>{customer.email}</span>}
              {customer.phone && <span>{customer.phone}</span>}
            </div>
          </div>
        </div>
        <span className={`badge badge-${customer.collection_priority === 'critical' ? '90' : customer.collection_priority === 'high' ? '60' : 'current'}`}>
          {customer.collection_priority} priority
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Outstanding</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--status-error)' }}>
            {formatCurrency(customer.total_outstanding)}
          </div>
        </div>
        <div className="card">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Open Invoices</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {customer.invoice_count}
          </div>
        </div>
        <div className="card">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Collection Status</div>
          <div className="text-xl font-bold capitalize" style={{ color: 'var(--christmas-cream)' }}>
            {customer.collection_status}
          </div>
        </div>
        <div className="card">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Next Followup</div>
          <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {customer.next_followup_date ? formatDate(customer.next_followup_date) : 'Not set'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {(['invoices', 'payments', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-6 py-3 text-sm font-medium capitalize transition-colors"
              style={{
                color: activeTab === tab ? 'var(--christmas-green-light)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--christmas-green)' : '2px solid transparent',
              }}
            >
              {tab} ({tab === 'invoices' ? customer.invoices.length : tab === 'payments' ? customer.payments.length : customer.notes.length})
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'invoices' && (
            <div className="space-y-2">
              {customer.invoices.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No invoices
                </div>
              ) : (
                customer.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex justify-between items-center p-3 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        Invoice #{invoice.invoice_number}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(invoice.invoice_date)} · {invoice.days_outstanding} days
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: 'var(--status-error)' }}>
                        {formatCurrency(invoice.balance)}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        of {formatCurrency(invoice.invoice_total)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-2">
              {customer.payments.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No payments
                </div>
              ) : (
                customer.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {payment.payment_type}
                      </div>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(payment.payment_date)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-2">
              {customer.notes.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No notes
                </div>
              ) : (
                customer.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                        {note.author_initials}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(note.note_date)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {note.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
