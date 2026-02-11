'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { APContractorWithStats, APContractorRate, APContractorRateHistory } from '@/lib/supabase';
import { formatCurrency, formatDate, formatTimestamp } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';

interface PaymentJob {
  id: string;
  job_number: string;
  trade: string;
  job_type_name: string | null;
  business_unit_name: string | null;
  customer_name: string | null;
  payment_amount: number | null;
  payment_status: string;
  payment_paid_at: string | null;
  completed_date: string | null;
  scheduled_date: string | null;
}

interface PaymentAvg {
  trade: string;
  job_type: string;
  count: number;
  total: number;
  avg: number;
}

type HistoryTab = 'payments' | 'rate-changes';

export default function ContractorDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { canManageContractors } = useAPPermissions();

  const [contractor, setContractor] = useState<APContractorWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // New rate form
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateTrade, setRateTrade] = useState<'hvac' | 'plumbing'>('hvac');
  const [rateJobType, setRateJobType] = useState('');
  const [rateAmount, setRateAmount] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  // History
  const [historyTab, setHistoryTab] = useState<HistoryTab>('payments');
  const [payments, setPayments] = useState<PaymentJob[]>([]);
  const [rateHistory, setRateHistory] = useState<APContractorRateHistory[]>([]);
  const [averages, setAverages] = useState<PaymentAvg[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadContractor = useCallback(async () => {
    try {
      const res = await fetch(`/api/contractors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContractor(data);
        setName(data.name);
        setContactName(data.contact_name || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setPaymentMethod(data.payment_method || '');
        setPaymentNotes(data.payment_notes || '');
      }
    } catch (err) {
      console.error('Failed to load contractor:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/contractors/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setRateHistory(data.rateHistory || []);
        setAverages(data.averages || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [id]);

  useEffect(() => {
    loadContractor();
    loadHistory();
  }, [loadContractor, loadHistory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contractors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact_name: contactName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          payment_method: paymentMethod || null,
          payment_notes: paymentNotes.trim() || null,
        }),
      });

      if (res.ok) {
        setEditing(false);
        await loadContractor();
      }
    } catch (err) {
      console.error('Failed to update contractor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!contractor) return;
    const res = await fetch(`/api/contractors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !contractor.is_active }),
    });
    if (res.ok) await loadContractor();
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateJobType.trim() || !rateAmount) return;

    setSavingRate(true);
    try {
      const res = await fetch(`/api/contractors/${id}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade: rateTrade,
          job_type_name: rateJobType.trim(),
          rate_amount: parseFloat(rateAmount),
        }),
      });

      if (res.ok) {
        setRateJobType('');
        setRateAmount('');
        setShowRateForm(false);
        await loadContractor();
        await loadHistory();
      }
    } catch (err) {
      console.error('Failed to add rate:', err);
    } finally {
      setSavingRate(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-48 rounded mt-4 animate-pulse" style={{ background: 'var(--border-subtle)' }} />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="text-center py-12">
        <div className="text-lg" style={{ color: 'var(--text-secondary)' }}>Contractor not found</div>
        <button onClick={() => router.push('/contractors')} className="btn btn-secondary mt-4">
          Back to Contractors
        </button>
      </div>
    );
  }

  const hvacRates = contractor.rates.filter(r => r.trade === 'hvac');
  const plumbingRates = contractor.rates.filter(r => r.trade === 'plumbing');
  const paidPayments = payments.filter(p => p.payment_status === 'paid');
  const pendingPayments = payments.filter(p => p.payment_status !== 'paid' && p.payment_status !== 'none');

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push('/contractors')}
        className="text-sm mb-4 flex items-center gap-1"
        style={{ color: 'var(--christmas-green-light)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Contractors
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {contractor.name}
          </h1>
          {!contractor.is_active && (
            <span
              className="badge mt-1"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
            >
              Inactive
            </span>
          )}
        </div>
        {canManageContractors && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} className="btn btn-secondary">
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleToggleActive}
              className="btn btn-secondary"
              style={{ color: contractor.is_active ? 'var(--status-error)' : 'var(--status-success)' }}
            >
              {contractor.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Total Jobs</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {contractor.total_jobs}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Total Paid</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--status-success)' }}>
            {formatCurrency(contractor.total_paid)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Outstanding</div>
          <div className="text-xl font-bold mt-1" style={{ color: contractor.total_outstanding > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
            {formatCurrency(contractor.total_outstanding)}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Details + History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details / Edit Form */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Details
            </h3>
            {editing ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Contact</label>
                  <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Method</label>
                  <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="paper_invoice">Paper Invoice</option>
                    <option value="text_message">Text Message</option>
                    <option value="formal_invoice">Formal Invoice</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Notes</label>
                  <input className="input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                </div>
                <div className="lg:col-span-2 flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Contact</div>
                  <div style={{ color: 'var(--text-primary)' }}>{contractor.contact_name || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Phone</div>
                  <div style={{ color: 'var(--text-primary)' }}>{contractor.phone || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ color: 'var(--text-primary)' }}>{contractor.email || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Payment Method</div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {contractor.payment_method ? contractor.payment_method.replace(/_/g, ' ') : '—'}
                  </div>
                </div>
                {contractor.payment_notes && (
                  <div className="col-span-2">
                    <div style={{ color: 'var(--text-muted)' }}>Payment Notes</div>
                    <div style={{ color: 'var(--text-primary)' }}>{contractor.payment_notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Average Rates by Job Type */}
          {averages.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Average Payment by Job Type
              </h3>
              <div className="space-y-2">
                {averages
                  .sort((a, b) => a.trade.localeCompare(b.trade) || a.job_type.localeCompare(b.job_type))
                  .map((avg) => (
                  <div
                    key={`${avg.trade}-${avg.job_type}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    <div>
                      <span
                        className="text-xs font-semibold uppercase mr-2"
                        style={{ color: avg.trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)' }}
                      >
                        {avg.trade}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {avg.job_type}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatCurrency(avg.avg)}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        ({avg.count} job{avg.count !== 1 ? 's' : ''}, {formatCurrency(avg.total)} total)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment History / Rate Changes */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                History
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setHistoryTab('payments')}
                  className="px-3 py-1 text-sm rounded-lg transition-colors"
                  style={{
                    background: historyTab === 'payments' ? 'var(--christmas-green)' : 'transparent',
                    color: historyTab === 'payments' ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  Payments ({payments.length})
                </button>
                <button
                  onClick={() => setHistoryTab('rate-changes')}
                  className="px-3 py-1 text-sm rounded-lg transition-colors"
                  style={{
                    background: historyTab === 'rate-changes' ? 'var(--christmas-green)' : 'transparent',
                    color: historyTab === 'rate-changes' ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  Rate Changes ({rateHistory.length})
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading history...</div>
            ) : historyTab === 'payments' ? (
              payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Job #</th>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Customer</th>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Amount</th>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr
                          key={p.id}
                          className="cursor-pointer hover:opacity-80"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onClick={() => router.push(`/jobs/${p.id}`)}
                        >
                          <td className="py-2 px-2" style={{ color: 'var(--christmas-green-light)' }}>
                            {p.job_number}
                          </td>
                          <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>
                            {p.customer_name || '—'}
                          </td>
                          <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                            <span
                              className="text-xs font-semibold uppercase mr-1"
                              style={{ color: p.trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)' }}
                            >
                              {p.trade}
                            </span>
                            {p.job_type_name || ''}
                          </td>
                          <td className="py-2 px-2 text-right font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {p.payment_amount ? formatCurrency(p.payment_amount) : '—'}
                          </td>
                          <td className="py-2 px-2">
                            <PaymentStatusPill status={p.payment_status} />
                          </td>
                          <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                            {formatDate(p.payment_paid_at?.split('T')[0] || p.completed_date || p.scheduled_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No payment history yet. Assign jobs to this contractor to start tracking payments.
                </div>
              )
            ) : (
              rateHistory.length > 0 ? (
                <div className="space-y-2">
                  {rateHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg text-sm"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <div>
                        <span
                          className="text-xs font-semibold uppercase mr-1"
                          style={{ color: h.trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)' }}
                        >
                          {h.trade}
                        </span>
                        <span style={{ color: 'var(--text-primary)' }}>{h.job_type_name}</span>
                        <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                          {h.change_type === 'created' ? 'set to' : (
                            <>
                              {formatCurrency(h.old_amount)} →
                            </>
                          )}
                        </span>
                        <span className="ml-1 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                          {formatCurrency(h.new_amount)}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(h.effective_date)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No rate changes recorded yet. Changes to the rate card will be tracked here.
                </div>
              )
            )}
          </div>
        </div>

        {/* Right column - Rate Card */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Rate Card
              </h3>
              {canManageContractors && (
                <button
                  onClick={() => setShowRateForm(!showRateForm)}
                  className="btn btn-secondary text-sm"
                >
                  {showRateForm ? 'Cancel' : '+ Add Rate'}
                </button>
              )}
            </div>

            {/* Add Rate Form */}
            {showRateForm && (
              <form onSubmit={handleAddRate} className="mb-4 p-4 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Trade</label>
                    <select className="select" value={rateTrade} onChange={(e) => setRateTrade(e.target.value as 'hvac' | 'plumbing')}>
                      <option value="hvac">HVAC</option>
                      <option value="plumbing">Plumbing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Job Type</label>
                    <input
                      className="input"
                      placeholder="e.g. Full System Replacement"
                      value={rateJobType}
                      onChange={(e) => setRateJobType(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Rate ($)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={rateAmount}
                      onChange={(e) => setRateAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="submit" disabled={savingRate} className="btn btn-primary text-sm">
                    {savingRate ? 'Saving...' : 'Add Rate'}
                  </button>
                </div>
              </form>
            )}

            {/* HVAC Rates */}
            {hvacRates.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--christmas-green-light)' }}>
                  HVAC
                </div>
                <div className="space-y-2">
                  {hvacRates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {rate.job_type_name}
                      </span>
                      <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatCurrency(rate.rate_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plumbing Rates */}
            {plumbingRates.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--christmas-gold)' }}>
                  Plumbing
                </div>
                <div className="space-y-2">
                  {plumbingRates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {rate.job_type_name}
                      </span>
                      <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatCurrency(rate.rate_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {contractor.rates.length === 0 && !showRateForm && (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No rates configured yet. Add rates to auto-suggest payment amounts when assigning jobs.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentStatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    none: { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af' },
    requested: { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15' },
    approved: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
    paid: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' },
  };
  const s = styles[status] || styles.none;
  const label = status === 'none' ? 'None' : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}
