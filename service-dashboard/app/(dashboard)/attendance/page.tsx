'use client';

import { useState, useEffect, useCallback } from 'react';
import { useServiceDashboardPermissions } from '@/hooks/usePermissions';
import type { AttendanceInfractionType, InfractionTypeConfig, AttendanceThreshold } from '@/lib/supabase';
import { DEFAULT_INFRACTION_TYPES, DEFAULT_THRESHOLDS } from '@/lib/supabase';

interface AuditLogEntry {
  id: string;
  record_id: string;
  technician_id: string;
  action: 'added' | 'removed';
  record_data: {
    date: string;
    type: AttendanceInfractionType;
    points: number;
    notes?: string | null;
    originally_created_by?: string;
    originally_created_at?: string;
  };
  performed_by: string;
  performed_at: string;
}

interface TechSummary {
  id: string;
  st_technician_id: number;
  name: string;
  trade: string;
  total_points: number;
  record_count: number;
  last_infraction_date: string | null;
  records: AttendanceRecord[];
}

interface AttendanceRecord {
  id: string;
  technician_id: string;
  date: string;
  type: AttendanceInfractionType;
  points: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PointsBadge({ points, thresholds }: { points: number; thresholds: AttendanceThreshold[] }) {
  let color = 'var(--status-success)';
  let bg = 'rgba(34, 197, 94, 0.1)';

  // Use the first two thresholds for color coding (approaching vs at-warning)
  const sortedThresholds = [...thresholds].sort((a, b) => a.points - b.points);
  const warningLevel = sortedThresholds.length >= 2 ? sortedThresholds[1].points : 6;
  const approachLevel = sortedThresholds.length >= 1 ? sortedThresholds[0].points : 3;

  if (points >= warningLevel) {
    color = 'var(--status-error)';
    bg = 'rgba(239, 68, 68, 0.1)';
  } else if (points >= approachLevel) {
    color = 'var(--status-warning)';
    bg = 'rgba(234, 179, 8, 0.1)';
  }

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold"
      style={{ color, backgroundColor: bg }}
    >
      {points % 1 === 0 ? points : points.toFixed(1)} pts
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

// Point system reference popover
function PointSystemInfo({
  onClose,
  infractionTypes,
  thresholds,
  rollingMonths,
}: {
  onClose: () => void;
  infractionTypes: InfractionTypeConfig[];
  thresholds: AttendanceThreshold[];
  rollingMonths: number;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.point-system-popover')) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const sortedThresholds = [...thresholds].sort((a, b) => a.points - b.points);

  return (
    <div
      className="point-system-popover absolute right-0 top-full mt-2 z-50 w-80 rounded-lg p-4 text-left text-sm shadow-xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Point System</p>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }} className="p-1 rounded hover:bg-[var(--bg-card-hover)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5">
        {infractionTypes.map((config) => (
          <div key={config.key} className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>{config.label}</span>
            <span
              className="font-mono text-xs font-bold"
              style={{
                color: config.points === 0 ? 'var(--text-muted)'
                  : config.points < 0 ? 'var(--status-success)'
                  : config.points >= 3 ? 'var(--status-error)'
                  : config.points >= 2 ? 'var(--status-warning)'
                  : 'var(--text-primary)',
              }}
            >
              {config.points > 0 ? '+' : ''}{config.points}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        Points accumulate over rolling {rollingMonths} months. Thresholds: {sortedThresholds.map(t => `${t.points} pts = ${t.label.toLowerCase()}`).join(', ')}.
      </div>
    </div>
  );
}

// Add Record Modal
function AddRecordModal({
  technicians,
  infractionTypes,
  onClose,
  onSave,
}: {
  technicians: { id: string; name: string }[];
  infractionTypes: InfractionTypeConfig[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [techId, setTechId] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [type, setType] = useState(infractionTypes.length > 0 ? infractionTypes[0].key : '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const selectedConfig = infractionTypes.find(t => t.key === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techId) { setError('Select a technician'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: techId, date, type, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }
      onSave();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Add Attendance Record
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)]" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)', border: '1px solid var(--status-error)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Technician</label>
            <select value={techId} onChange={(e) => setTechId(e.target.value)} className="input w-full">
              <option value="">Select technician...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input w-full">
              {infractionTypes.map((config) => (
                <option key={config.key} value={config.key}>
                  {config.label} ({config.points > 0 ? '+' : ''}{config.points} pts)
                </option>
              ))}
            </select>
            {selectedConfig && (
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Points: <span className="font-mono font-bold" style={{
                  color: selectedConfig.points === 0 ? 'var(--text-muted)'
                    : selectedConfig.points < 0 ? 'var(--status-success)'
                    : 'var(--text-primary)',
                }}>
                  {selectedConfig.points > 0 ? '+' : ''}{selectedConfig.points}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input w-full"
              placeholder="Additional details..."
            />
          </div>

          <button
            type="submit"
            disabled={saving || !techId}
            className="btn btn-primary w-full"
            style={{ opacity: saving || !techId ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : 'Add Record'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { canManageAttendance } = useServiceDashboardPermissions();
  const [technicians, setTechnicians] = useState<TechSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPointSystem, setShowPointSystem] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState<(AuditLogEntry & { technician_name: string })[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Config from DB
  const [infractionTypes, setInfractionTypes] = useState<InfractionTypeConfig[]>(DEFAULT_INFRACTION_TYPES);
  const [thresholds, setThresholds] = useState<AttendanceThreshold[]>(DEFAULT_THRESHOLDS);
  const [rollingMonths, setRollingMonths] = useState(12);

  // Build a lookup map from config
  const infractionMap = new Map(infractionTypes.map(t => [t.key, t]));

  useEffect(() => {
    fetch('/api/settings/attendance')
      .then(res => res.json())
      .then(data => {
        if (data.infraction_types) setInfractionTypes(data.infraction_types);
        if (data.thresholds) setThresholds(data.thresholds);
        if (data.rolling_months) setRollingMonths(data.rolling_months);
      })
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const data = await res.json();
        setTechnicians(data.technicians || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/attendance?audit=true');
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.audit_log || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (showAuditLog && auditLog.length === 0) {
      fetchAuditLog();
    }
  }, [showAuditLog, auditLog.length, fetchAuditLog]);

  const handleDelete = async (recordId: string) => {
    if (!confirm('Remove this attendance record?')) return;

    try {
      const res = await fetch(`/api/attendance/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Record removed.' });
        fetchData();
        if (showAuditLog) fetchAuditLog();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to remove.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  };

  // Summary stats - use threshold config for color coding
  const sortedThresholds = [...thresholds].sort((a, b) => a.points - b.points);
  const approachLevel = sortedThresholds.length >= 1 ? sortedThresholds[0].points : 3;
  const warningLevel = sortedThresholds.length >= 2 ? sortedThresholds[1].points : 6;

  const zeroPoints = technicians.filter(t => t.total_points === 0).length;
  const approachingThreshold = technicians.filter(t => t.total_points >= approachLevel && t.total_points < warningLevel).length;
  const atWarning = technicians.filter(t => t.total_points >= warningLevel).length;

  // Sort: highest points first, then alphabetical
  const sorted = [...technicians].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Attendance Tracker
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Technician attendance point system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowPointSystem(!showPointSystem)}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Point System
            </button>
            {showPointSystem && (
              <PointSystemInfo
                onClose={() => setShowPointSystem(false)}
                infractionTypes={infractionTypes}
                thresholds={thresholds}
                rollingMonths={rollingMonths}
              />
            )}
          </div>
          {canManageAttendance && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Record
            </button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? 'var(--status-success)' : 'var(--status-error)'}`,
            color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Active Technicians" value={technicians.length} color="var(--text-primary)" />
        <SummaryCard label="Clean Record (0 pts)" value={zeroPoints} color="var(--status-success)" />
        <SummaryCard
          label={`Approaching (${approachLevel}-${warningLevel - 1} pts)`}
          value={approachingThreshold}
          color="var(--status-warning)"
        />
        <SummaryCard
          label={`At Warning (${warningLevel}+ pts)`}
          value={atWarning}
          color="var(--status-error)"
        />
      </div>

      {/* Technician Table */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Loading attendance data...</p>
        </div>
      ) : technicians.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <p className="text-lg mb-2">No technicians found</p>
          <p className="text-sm">Run a sync to populate technician data.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th className="text-center">Points</th>
                  <th className="text-center">Records</th>
                  <th>Last Infraction</th>
                  <th className="text-center" style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tech) => (
                  <TechRow
                    key={tech.id}
                    tech={tech}
                    expanded={expandedTech === tech.id}
                    onToggle={() => setExpandedTech(expandedTech === tech.id ? null : tech.id)}
                    onDelete={canManageAttendance ? handleDelete : undefined}
                    infractionMap={infractionMap}
                    thresholds={thresholds}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="mt-6">
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="flex items-center gap-2 text-sm font-medium mb-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg
            className="w-4 h-4 transition-transform"
            style={{ transform: showAuditLog ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Audit Trail
        </button>

        {showAuditLog && (
          <div className="card p-0 overflow-hidden">
            {auditLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
              </div>
            ) : auditLog.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No audit history yet.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {auditLog.map((entry) => {
                  const config = infractionMap.get(entry.record_data.type);
                  const isRemoval = entry.action === 'removed';
                  return (
                    <div key={entry.id} className="px-6 py-3 flex items-start gap-3">
                      <div
                        className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isRemoval ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        }}
                      >
                        {isRemoval ? (
                          <svg className="w-3.5 h-3.5" style={{ color: 'var(--status-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" style={{ color: 'var(--status-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          <span className="font-medium">{entry.performed_by.split('@')[0]}</span>
                          {' '}
                          <span style={{ color: isRemoval ? 'var(--status-error)' : 'var(--status-success)' }}>
                            {isRemoval ? 'removed' : 'added'}
                          </span>
                          {' '}
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {config?.label || entry.record_data.type}
                          </span>
                          {' '}
                          ({entry.record_data.points > 0 ? '+' : ''}{entry.record_data.points} pts)
                          {' for '}
                          <span className="font-medium">{entry.technician_name}</span>
                          {' on '}
                          {formatDate(entry.record_data.date)}
                        </p>
                        {entry.record_data.notes && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Note: {entry.record_data.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.performed_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <AddRecordModal
          technicians={technicians.map(t => ({ id: t.id, name: t.name }))}
          infractionTypes={infractionTypes}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setMessage({ type: 'success', text: 'Record added.' });
            fetchData();
            if (showAuditLog) fetchAuditLog();
          }}
        />
      )}
    </div>
  );
}

function TechRow({
  tech,
  expanded,
  onToggle,
  onDelete,
  infractionMap,
  thresholds,
}: {
  tech: TechSummary;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: (id: string) => void;
  infractionMap: Map<string, InfractionTypeConfig>;
  thresholds: AttendanceThreshold[];
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer">
        <td>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {tech.name}
          </span>
        </td>
        <td className="text-center">
          <PointsBadge points={tech.total_points} thresholds={thresholds} />
        </td>
        <td className="text-center">
          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
            {tech.record_count}
          </span>
        </td>
        <td>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tech.last_infraction_date ? formatDate(tech.last_infraction_date) : '—'}
          </span>
        </td>
        <td className="text-center">
          <svg
            className="w-4 h-4 transition-transform"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'var(--bg-secondary)', padding: 0 }}>
            {tech.records.length === 0 ? (
              <div className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                No attendance records.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="px-4 py-2 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Points</th>
                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Logged By</th>
                    {onDelete && <th className="px-4 py-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {tech.records.map((record) => {
                    const config = infractionMap.get(record.type);
                    return (
                      <tr key={record.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td className="px-6 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(record.date)}
                        </td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>
                          {config?.label || record.type}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className="font-mono font-bold text-xs"
                            style={{
                              color: record.points === 0 ? 'var(--text-muted)'
                                : record.points < 0 ? 'var(--status-success)'
                                : record.points >= 3 ? 'var(--status-error)'
                                : record.points >= 2 ? 'var(--status-warning)'
                                : 'var(--text-primary)',
                            }}
                          >
                            {record.points > 0 ? '+' : ''}{record.points}
                          </span>
                        </td>
                        <td className="px-4 py-2 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {record.notes || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {record.created_by?.split('@')[0] || '—'}
                        </td>
                        {onDelete && (
                          <td className="px-4 py-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
                              className="p-1 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              title="Remove record"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
