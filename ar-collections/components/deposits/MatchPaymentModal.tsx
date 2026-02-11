'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { ReconciliationRecord } from './PaymentReconciliationTable';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_total: number;
  balance: number;
  invoice_date: string;
}

interface MatchPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ReconciliationRecord | null;
  onMatch: (recordId: string, invoiceId: string) => Promise<void>;
}

export default function MatchPaymentModal({
  isOpen,
  onClose,
  record,
  onMatch,
}: MatchPaymentModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      // Pre-populate search with customer name if available
      if (record.customer_name) {
        setSearchTerm(record.customer_name);
      }
      searchInvoices(record.customer_name || '');
    }
  }, [isOpen, record]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setInvoices([]);
      setSelectedInvoice(null);
    }
  }, [isOpen]);

  async function searchInvoices(search: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('status', 'open');
      params.set('limit', '20');

      const response = await fetch(`/api/invoices?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('Error searching invoices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMatch() {
    if (!record || !selectedInvoice) return;

    setMatching(true);
    try {
      await onMatch(record.id, selectedInvoice);
      onClose();
    } catch (err) {
      console.error('Error matching payment:', err);
    } finally {
      setMatching(false);
    }
  }

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg shadow-xl"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Match Payment to Invoice
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Select an invoice to match this payment to
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Payment Info */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Amount</div>
              <div className="font-medium tabular-nums" style={{ color: 'var(--christmas-cream)' }}>
                {formatCurrency(record.amount)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</div>
              <div style={{ color: 'var(--christmas-cream)' }}>
                {formatDate(record.payment_date)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer (QB)</div>
              <div style={{ color: 'var(--christmas-cream)' }}>
                {record.customer_name || 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Type</div>
              <div className="capitalize" style={{ color: 'var(--christmas-cream)' }}>
                {record.payment_type || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by invoice # or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchInvoices(searchTerm);
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--christmas-cream)',
                border: '1px solid var(--border-subtle)',
              }}
            />
            <button
              onClick={() => searchInvoices(searchTerm)}
              className="btn btn-secondary"
              disabled={loading}
            >
              Search
            </button>
          </div>
        </div>

        {/* Invoice List */}
        <div className="overflow-y-auto max-h-64 px-4">
          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Searching...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No invoices found. Try a different search term.
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => {
                const isSelected = selectedInvoice === invoice.id;
                const amountMatch = Math.abs(invoice.balance - record.amount) < 0.01 ||
                  Math.abs(invoice.invoice_total - record.amount) < 0.01;

                return (
                  <button
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice.id)}
                    className="w-full p-3 rounded-lg text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--christmas-green)' : 'var(--bg-secondary)',
                      border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium"
                            style={{ color: isSelected ? 'white' : 'var(--christmas-cream)' }}
                          >
                            {invoice.invoice_number}
                          </span>
                          {amountMatch && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(34, 197, 94, 0.15)',
                                color: isSelected ? 'white' : 'var(--christmas-green)',
                              }}
                            >
                              Amount Match
                            </span>
                          )}
                        </div>
                        <div
                          className="text-sm mt-0.5"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}
                        >
                          {invoice.customer_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="font-medium tabular-nums"
                          style={{ color: isSelected ? 'white' : 'var(--christmas-cream)' }}
                        >
                          {formatCurrency(invoice.balance)} due
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                        >
                          {formatDate(invoice.invoice_date)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-4 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleMatch}
            disabled={!selectedInvoice || matching}
            className="btn btn-primary"
          >
            {matching ? 'Matching...' : 'Match Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
