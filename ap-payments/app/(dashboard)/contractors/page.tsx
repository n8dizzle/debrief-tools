'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { APContractor } from '@/lib/supabase';
import { useAPPermissions } from '@/hooks/useAPPermissions';

export default function ContractorsPage() {
  const { canManageContractors } = useAPPermissions();
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

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

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
          Contractors
        </h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 w-48 rounded" style={{ background: 'var(--border-subtle)' }} />
              <div className="h-4 w-32 rounded mt-2" style={{ background: 'var(--border-subtle)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Contractors
        </h1>
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

      {/* Contractors List */}
      {contractors.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            No contractors yet
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Add your first contractor to get started
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {contractors.map((contractor) => (
            <Link
              key={contractor.id}
              href={`/contractors/${contractor.id}`}
              className="card block transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--christmas-cream)' }}>
                    {contractor.name}
                  </h3>
                  {contractor.contact_name && (
                    <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {contractor.contact_name}
                    </div>
                  )}
                  <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {contractor.phone && <span>{contractor.phone}</span>}
                    {contractor.email && <span>{contractor.email}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contractor.trade && (
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
                        {contractor.trade === 'both' ? 'HVAC & Plumbing' : contractor.trade.toUpperCase()}
                      </span>
                    )}
                    {contractor.payment_method && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(93, 138, 102, 0.15)',
                          color: 'var(--christmas-green-light)',
                        }}
                      >
                        {contractor.payment_method.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {!contractor.is_active && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                      }}
                    >
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
