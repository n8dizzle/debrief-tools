'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { APContractor } from '@/lib/supabase';
import { useAPPermissions } from '@/hooks/useAPPermissions';

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

function getComplianceBadge(c: APContractor): { label: string; color: string; bg: string } {
  const now = new Date();
  const checkDate = (d: string | null) => {
    if (!d) return 'missing';
    const exp = new Date(d + 'T00:00:00');
    const diffDays = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
  };

  const docs = c.has_coi && c.has_w9 && c.has_signed_agreement;
  const gl = checkDate(c.gl_expiration_date);
  const auto = checkDate(c.auto_expiration_date);
  const wc = checkDate(c.wc_expiration_date);
  const statuses = [gl, auto, wc];

  if (statuses.includes('expired') || !docs) {
    return { label: 'Incomplete', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (statuses.includes('expiring') || statuses.includes('missing')) {
    return { label: 'Review', color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)' };
  }
  return { label: 'Compliant', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' };
}

export default function ContractorsPage() {
  const router = useRouter();
  const { canManageContractors } = useAPPermissions();
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Add form state
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [trade, setTrade] = useState('both');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadContractors = useCallback(async () => {
    try {
      const res = await fetch('/api/contractors');
      if (res.ok) {
        setContractors(await res.json());
      }
    } catch (err) {
      console.error('Failed to load contractors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/contractors', {
        method: 'POST',
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
        setName('');
        setContactName('');
        setPhone('');
        setEmail('');
        setTrade('both');
        setPaymentMethod('');
        setPaymentNotes('');
        setShowAddForm(false);
        await loadContractors();
      }
    } catch (err) {
      console.error('Failed to add contractor:', err);
    } finally {
      setSaving(false);
    }
  };

  const filtered = contractors.filter((c) => {
    if (filter === 'active') return c.is_active;
    if (filter === 'inactive') return !c.is_active;
    return true;
  });

  const activeCount = contractors.filter(c => c.is_active).length;
  const inactiveCount = contractors.filter(c => !c.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Contractors
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {activeCount} active{inactiveCount > 0 && `, ${inactiveCount} inactive`}
          </p>
        </div>
        {canManageContractors && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
          >
            {showAddForm ? 'Cancel' : '+ Add Contractor'}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="card mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            New Contractor
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Company / Name *
              </label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Contact Name
              </label>
              <input
                type="text"
                className="input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Phone
              </label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Trade
              </label>
              <select
                className="select"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
              >
                <option value="both">Both (HVAC & Plumbing)</option>
                <option value="hvac">HVAC Only</option>
                <option value="plumbing">Plumbing Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Payment Method
              </label>
              <select
                className="select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="paper_invoice">Paper Invoice</option>
                <option value="text_message">Text Message</option>
                <option value="formal_invoice">Formal Invoice</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Payment Notes
              </label>
              <input
                type="text"
                className="input"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="How they prefer to be paid..."
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn btn-primary"
              style={{ opacity: saving || !name.trim() ? 0.5 : 1 }}
            >
              {saving ? 'Saving...' : 'Add Contractor'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Show:</span>
        {([
          { value: 'active', label: 'Active', color: 'var(--status-success)' },
          { value: 'all', label: 'All', color: 'var(--text-secondary)' },
          { value: 'inactive', label: 'Inactive', color: 'var(--status-error)' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filter === opt.value ? `${opt.color}20` : 'var(--bg-secondary)',
              color: filter === opt.value ? opt.color : 'var(--text-secondary)',
              border: filter === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 rounded" style={{ background: 'var(--border-subtle)' }} />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            {contractors.length === 0 ? 'No contractors yet' : 'No contractors match this filter'}
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {contractors.length === 0 ? 'Add your first contractor to get started' : 'Try a different filter'}
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="ap-table" style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Trade</th>
                  <th>Compliance</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer', opacity: !c.is_active ? 0.5 : 1 }}
                    onClick={() => router.push(`/contractors/${c.id}`)}
                  >
                    <td>
                      <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {c.name}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {c.contact_name || '—'}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatPhone(c.phone)}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {c.email || '—'}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: c.trade === 'hvac'
                            ? 'rgba(93, 138, 102, 0.15)'
                            : c.trade === 'plumbing'
                              ? 'rgba(184, 149, 107, 0.15)'
                              : 'rgba(96, 165, 250, 0.15)',
                          color: c.trade === 'hvac'
                            ? 'var(--christmas-green-light)'
                            : c.trade === 'plumbing'
                              ? 'var(--christmas-gold)'
                              : '#60a5fa',
                        }}
                      >
                        {c.trade === 'both' ? 'HVAC & Plumbing' : c.trade.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const badge = getComplianceBadge(c);
                        return (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {c.payment_method ? c.payment_method.replace(/_/g, ' ') : '—'}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: c.is_active
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: c.is_active ? 'var(--status-success)' : '#f87171',
                        }}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
