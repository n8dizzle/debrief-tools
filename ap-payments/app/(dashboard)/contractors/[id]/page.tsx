'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { APContractorWithStats, APContractorRate, APContractorRateHistory } from '@/lib/supabase';
import { formatCurrency, formatDate, formatTimestamp } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

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
  const [trade, setTrade] = useState('both');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Compliance edit form
  const [editingCompliance, setEditingCompliance] = useState(false);
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [complianceForm, setComplianceForm] = useState({
    has_coi: false,
    has_w9: false,
    has_signed_agreement: false,
    gl_expiration_date: '',
    gl_amount: '',
    auto_expiration_date: '',
    auto_amount: '',
    wc_expiration_date: '',
    wc_amount: '',
    business_address: '',
    compliance_notes: '',
  });

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
        setTrade(data.trade || 'both');
        setPaymentMethod(data.payment_method || '');
        setPaymentNotes(data.payment_notes || '');
        setComplianceForm({
          has_coi: data.has_coi || false,
          has_w9: data.has_w9 || false,
          has_signed_agreement: data.has_signed_agreement || false,
          gl_expiration_date: data.gl_expiration_date || '',
          gl_amount: data.gl_amount != null ? String(data.gl_amount) : '',
          auto_expiration_date: data.auto_expiration_date || '',
          auto_amount: data.auto_amount != null ? String(data.auto_amount) : '',
          wc_expiration_date: data.wc_expiration_date || '',
          wc_amount: data.wc_amount != null ? String(data.wc_amount) : '',
          business_address: data.business_address || '',
          compliance_notes: data.compliance_notes || '',
        });
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
          trade: trade || 'both',
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

  const handleSaveCompliance = async () => {
    setSavingCompliance(true);
    try {
      const res = await fetch(`/api/contractors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          has_coi: complianceForm.has_coi,
          has_w9: complianceForm.has_w9,
          has_signed_agreement: complianceForm.has_signed_agreement,
          gl_expiration_date: complianceForm.gl_expiration_date || null,
          gl_amount: complianceForm.gl_amount ? parseFloat(complianceForm.gl_amount) : null,
          auto_expiration_date: complianceForm.auto_expiration_date || null,
          auto_amount: complianceForm.auto_amount ? parseFloat(complianceForm.auto_amount) : null,
          wc_expiration_date: complianceForm.wc_expiration_date || null,
          wc_amount: complianceForm.wc_amount ? parseFloat(complianceForm.wc_amount) : null,
          business_address: complianceForm.business_address.trim() || null,
          compliance_notes: complianceForm.compliance_notes.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingCompliance(false);
        await loadContractor();
      }
    } catch (err) {
      console.error('Failed to save compliance:', err);
    } finally {
      setSavingCompliance(false);
    }
  };

  const handleUploadDoc = async (docType: string, file: File) => {
    setUploadingDoc(docType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      const res = await fetch(`/api/contractors/${id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await loadContractor();
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleRemoveDoc = async (docType: string) => {
    if (!contractor) return;
    try {
      await fetch(`/api/contractors/${id}/upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType }),
      });
      await loadContractor();
    } catch (err) {
      console.error('Remove failed:', err);
    }
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
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Trade</label>
                  <select className="select" value={trade} onChange={(e) => setTrade(e.target.value)}>
                    <option value="both">Both (HVAC & Plumbing)</option>
                    <option value="hvac">HVAC Only</option>
                    <option value="plumbing">Plumbing Only</option>
                  </select>
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
                  <div style={{ color: 'var(--text-primary)' }}>{formatPhone(contractor.phone)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ color: 'var(--text-primary)' }}>{contractor.email || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Trade</div>
                  <div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: contractor.trade === 'hvac'
                          ? 'rgba(93, 138, 102, 0.15)'
                          : contractor.trade === 'plumbing'
                            ? 'rgba(184, 149, 107, 0.15)'
                            : 'rgba(96, 165, 250, 0.15)',
                        color: contractor.trade === 'hvac'
                          ? 'var(--christmas-green-light)'
                          : contractor.trade === 'plumbing'
                            ? 'var(--christmas-gold)'
                            : '#60a5fa',
                      }}
                    >
                      {contractor.trade === 'both' ? 'HVAC & Plumbing' : (contractor.trade || 'both').toUpperCase()}
                    </span>
                  </div>
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

          {/* Compliance */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Compliance
              </h3>
              {canManageContractors && (
                <button
                  onClick={() => {
                    if (editingCompliance) {
                      // Reset form on cancel
                      setComplianceForm({
                        has_coi: contractor.has_coi || false,
                        has_w9: contractor.has_w9 || false,
                        has_signed_agreement: contractor.has_signed_agreement || false,
                        gl_expiration_date: contractor.gl_expiration_date || '',
                        gl_amount: contractor.gl_amount != null ? String(contractor.gl_amount) : '',
                        auto_expiration_date: contractor.auto_expiration_date || '',
                        auto_amount: contractor.auto_amount != null ? String(contractor.auto_amount) : '',
                        wc_expiration_date: contractor.wc_expiration_date || '',
                        wc_amount: contractor.wc_amount != null ? String(contractor.wc_amount) : '',
                        business_address: contractor.business_address || '',
                        compliance_notes: contractor.compliance_notes || '',
                      });
                    }
                    setEditingCompliance(!editingCompliance);
                  }}
                  className="btn btn-secondary text-sm"
                >
                  {editingCompliance ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>

            {editingCompliance ? (
              <div className="space-y-4">
                {/* Document uploads */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Documents
                  </div>
                  {([
                    { docType: 'coi', boolKey: 'has_coi' as const, label: 'Certificate of Insurance', urlKey: 'coi_file_url' as const },
                    { docType: 'w9', boolKey: 'has_w9' as const, label: 'W-9', urlKey: 'w9_file_url' as const },
                    { docType: 'agreement', boolKey: 'has_signed_agreement' as const, label: 'Signed Agreement', urlKey: 'agreement_file_url' as const },
                  ]).map(({ docType, boolKey, label, urlKey }) => {
                    const fileUrl = contractor?.[urlKey];
                    const isUploading = uploadingDoc === docType;
                    return (
                      <div
                        key={docType}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{ background: 'var(--bg-primary)' }}
                      >
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={complianceForm[boolKey]}
                              onChange={(e) => setComplianceForm(prev => ({ ...prev, [boolKey]: e.target.checked }))}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: 'var(--christmas-green)' }}
                            />
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                          </label>
                          {fileUrl && (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ color: 'var(--christmas-green)', background: 'rgba(34, 197, 94, 0.1)' }}
                            >
                              View
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isUploading ? (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uploading...</span>
                          ) : (
                            <>
                              <label
                                className="text-xs px-2 py-1 rounded cursor-pointer"
                                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
                              >
                                {fileUrl ? 'Replace' : 'Upload'}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadDoc(docType, f);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              {fileUrl && (
                                <button
                                  onClick={() => handleRemoveDoc(docType)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ color: '#f87171' }}
                                >
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Insurance rows */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Insurance Coverage
                  </div>
                  {([
                    { dateKey: 'gl_expiration_date' as const, amountKey: 'gl_amount' as const, label: 'General Liability' },
                    { dateKey: 'auto_expiration_date' as const, amountKey: 'auto_amount' as const, label: 'Auto Insurance' },
                    { dateKey: 'wc_expiration_date' as const, amountKey: 'wc_amount' as const, label: 'Workers Comp' },
                  ]).map(({ dateKey, amountKey, label }) => (
                    <div key={dateKey} className="grid grid-cols-3 gap-3 items-center">
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Expiration</label>
                        <input
                          type="date"
                          className="input text-sm"
                          value={complianceForm[dateKey]}
                          onChange={(e) => setComplianceForm(prev => ({ ...prev, [dateKey]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Coverage Amount</label>
                        <input
                          type="number"
                          className="input text-sm"
                          placeholder="0"
                          step="1000"
                          min="0"
                          value={complianceForm[amountKey]}
                          onChange={(e) => setComplianceForm(prev => ({ ...prev, [amountKey]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Address & Notes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Business Address</label>
                    <input
                      className="input"
                      value={complianceForm.business_address}
                      onChange={(e) => setComplianceForm(prev => ({ ...prev, business_address: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Compliance Notes</label>
                    <input
                      className="input"
                      value={complianceForm.compliance_notes}
                      onChange={(e) => setComplianceForm(prev => ({ ...prev, compliance_notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveCompliance} disabled={savingCompliance} className="btn btn-primary">
                    {savingCompliance ? 'Saving...' : 'Save Compliance'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Document status badges */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: contractor.has_coi, label: 'COI', url: contractor.coi_file_url },
                    { value: contractor.has_w9, label: 'W-9', url: contractor.w9_file_url },
                    { value: contractor.has_signed_agreement, label: 'Agreement', url: contractor.agreement_file_url },
                  ]).map(({ value, label, url }) => (
                    <span
                      key={label}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
                      style={{
                        backgroundColor: value ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: value ? '#4ade80' : '#f87171',
                      }}
                    >
                      {value ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {label}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 underline"
                          style={{ color: '#4ade80', fontSize: '0.75rem' }}
                        >
                          View
                        </a>
                      )}
                      {!url && value && (
                        <span className="ml-1" style={{ fontSize: '0.65rem', opacity: 0.6 }}>No file</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Insurance table */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Insurance Coverage
                  </div>
                  <div className="space-y-1">
                    {([
                      { date: contractor.gl_expiration_date, amount: contractor.gl_amount, label: 'General Liability' },
                      { date: contractor.auto_expiration_date, amount: contractor.auto_amount, label: 'Auto Insurance' },
                      { date: contractor.wc_expiration_date, amount: contractor.wc_amount, label: 'Workers Comp' },
                    ]).map(({ date, amount, label }) => {
                      const status = getExpirationStatus(date);
                      return (
                        <div
                          key={label}
                          className="flex items-center justify-between py-2 px-3 rounded-lg"
                          style={{ background: 'var(--bg-primary)' }}
                        >
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                          <div className="flex items-center gap-3">
                            {amount != null && (
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {formatCurrency(amount)}
                              </span>
                            )}
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: status.bg,
                                color: status.color,
                              }}
                            >
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Address & Notes */}
                {(contractor.business_address || contractor.compliance_notes) && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {contractor.business_address && (
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Business Address</div>
                        <div style={{ color: 'var(--text-primary)' }}>{contractor.business_address}</div>
                      </div>
                    )}
                    {contractor.compliance_notes && (
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Notes</div>
                        <div style={{ color: 'var(--text-primary)' }}>{contractor.compliance_notes}</div>
                      </div>
                    )}
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

function getExpirationStatus(date: string | null): { label: string; color: string; bg: string } {
  if (!date) return { label: 'Not Listed', color: '#9ca3af', bg: 'rgba(107, 114, 128, 0.15)' };
  const now = new Date();
  const exp = new Date(date + 'T00:00:00');
  const diffDays = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `Expired ${formatDate(date)}`, color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' };
  if (diffDays <= 30) return { label: `Exp ${formatDate(date)}`, color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)' };
  return { label: `Valid until ${formatDate(date)}`, color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' };
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
