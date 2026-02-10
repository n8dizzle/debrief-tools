'use client';

import { useState, useEffect } from 'react';
import { APInstallJob, APContractor, APContractorRate } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';

interface JobAssignmentModalProps {
  job: APInstallJob;
  contractors: APContractor[];
  onClose: () => void;
  onSave: (data: {
    assignment_type: 'in_house' | 'contractor';
    contractor_id?: string;
    payment_amount?: number;
  }) => Promise<void>;
}

export default function JobAssignmentModal({ job, contractors, onClose, onSave }: JobAssignmentModalProps) {
  const [assignmentType, setAssignmentType] = useState<'in_house' | 'contractor'>(
    job.assignment_type === 'contractor' ? 'contractor' : 'in_house'
  );
  const [contractorId, setContractorId] = useState<string>(job.contractor_id || '');
  const [paymentAmount, setPaymentAmount] = useState<string>(
    job.payment_amount != null ? String(job.payment_amount) : ''
  );
  const [rates, setRates] = useState<APContractorRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);

  // Load rates when contractor changes
  useEffect(() => {
    if (!contractorId || assignmentType !== 'contractor') {
      setRates([]);
      return;
    }

    async function loadRates() {
      setLoadingRates(true);
      try {
        const res = await fetch(`/api/contractors/${contractorId}/rates`);
        if (res.ok) {
          const data = await res.json();
          setRates(data);

          // Auto-fill rate if matching trade + job type
          const matchingRate = data.find((r: APContractorRate) =>
            r.trade === job.trade &&
            r.job_type_name.toLowerCase() === (job.job_type_name || '').toLowerCase()
          );
          if (matchingRate && !paymentAmount) {
            setPaymentAmount(String(matchingRate.rate_amount));
          }
        }
      } catch (err) {
        console.error('Failed to load rates:', err);
      } finally {
        setLoadingRates(false);
      }
    }

    loadRates();
  }, [contractorId, assignmentType]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        assignment_type: assignmentType,
        contractor_id: assignmentType === 'contractor' ? contractorId : undefined,
        payment_amount: assignmentType === 'contractor' && paymentAmount
          ? parseFloat(paymentAmount)
          : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save assignment:', err);
    } finally {
      setSaving(false);
    }
  };

  const matchingRates = rates.filter(r => r.trade === job.trade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Assign Job #{job.job_number}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Job Info */}
        <div className="mb-6 p-3 rounded-lg" style={{ background: 'var(--bg-card)' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div><strong>{job.customer_name}</strong></div>
            <div>{job.trade.toUpperCase()} — {job.job_type_name || 'Install'}</div>
            {job.job_total != null && <div>Job Total: {formatCurrency(job.job_total)}</div>}
          </div>
        </div>

        {/* Assignment Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Assignment Type
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setAssignmentType('in_house')}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: assignmentType === 'in_house' ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: assignmentType === 'in_house' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: `1px solid ${assignmentType === 'in_house' ? 'var(--christmas-green)' : 'var(--border-default)'}`,
              }}
            >
              In-House
            </button>
            <button
              onClick={() => setAssignmentType('contractor')}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: assignmentType === 'contractor' ? '#7c3aed' : 'var(--bg-card)',
                color: assignmentType === 'contractor' ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${assignmentType === 'contractor' ? '#7c3aed' : 'var(--border-default)'}`,
              }}
            >
              Contractor
            </button>
          </div>
        </div>

        {/* Contractor Selection */}
        {assignmentType === 'contractor' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Contractor
              </label>
              <select
                className="select"
                value={contractorId}
                onChange={(e) => {
                  setContractorId(e.target.value);
                  setPaymentAmount('');
                }}
              >
                <option value="">Select contractor...</option>
                {contractors.filter(c => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Rate Card Suggestions */}
            {matchingRates.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Rate Card
                </label>
                <div className="flex flex-wrap gap-2">
                  {matchingRates.map((rate) => (
                    <button
                      key={rate.id}
                      onClick={() => setPaymentAmount(String(rate.rate_amount))}
                      className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                      style={{
                        background: paymentAmount === String(rate.rate_amount)
                          ? 'rgba(93, 138, 102, 0.3)'
                          : 'var(--bg-card)',
                        border: `1px solid ${paymentAmount === String(rate.rate_amount) ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {rate.job_type_name}: {formatCurrency(rate.rate_amount)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Payment Amount
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  $
                </span>
                <input
                  type="number"
                  className="input pl-7"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              {loadingRates && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Loading rate card...
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (assignmentType === 'contractor' && !contractorId)}
            className="btn btn-primary"
            style={{
              opacity: saving || (assignmentType === 'contractor' && !contractorId) ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
