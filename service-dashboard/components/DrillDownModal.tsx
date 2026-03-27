'use client';

import { useEffect, useState, useMemo } from 'react';
import { INFRACTION_CONFIG, type AttendanceInfractionType } from '@/lib/supabase';

type Metric = 'gross_sales' | 'tgls' | 'options_per_opportunity' | 'reviews' | 'memberships_sold' | 'attendance';

interface Props {
  techName: string;
  stTechId: number;
  metric: Metric;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ST_BASE_URL = 'https://go.servicetitan.com';

function STLink({ type, id }: { type: 'Job' | 'Estimate' | 'Membership'; id: number }) {
  const path = type === 'Job' ? `Job/Index/${id}` : type === 'Estimate' ? `Estimate/Index/${id}` : `FollowUps/Membership/${id}`;
  return (
    <a
      href={`${ST_BASE_URL}/#/${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono inline-flex items-center gap-1"
      style={{ color: 'var(--christmas-green-light)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {id}
      <svg className="w-3 h-3 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// Reusable sort hook
function useSort<T>(records: T[], defaultKey: string, defaultAsc: boolean = false) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortAsc, setSortAsc] = useState(defaultAsc);

  const toggle = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key.includes('date') || key.includes('time') || key.includes('on') ? false : true);
    }
  };

  const sorted = useMemo(() => {
    return [...records].sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [records, sortKey, sortAsc]);

  return { sorted, sortKey, sortAsc, toggle };
}

function SortHeader({ label, field, sortKey, sortAsc, onSort, align }: {
  label: string; field: string; sortKey: string; sortAsc: boolean; onSort: (k: string) => void; align?: 'right';
}) {
  const active = sortKey === field;
  return (
    <th
      className={`py-2 font-medium cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: active ? 'var(--text-secondary)' : 'var(--text-muted)' }}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="ml-1 text-xs">
        {active ? (sortAsc ? '\u25B2' : '\u25BC') : '\u2195'}
      </span>
    </th>
  );
}

const METRIC_LABELS: Record<Metric, string> = {
  gross_sales: 'Sold Estimates',
  tgls: 'Leads Set',
  options_per_opportunity: 'Options per Opportunity',
  reviews: 'Google Reviews',
  memberships_sold: 'Memberships Sold',
  attendance: 'Attendance Records',
};

export default function DrillDownModal({ techName, stTechId, metric, startDate, endDate, onClose }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/leaderboard/details?techId=${stTechId}&metric=${metric}&startDate=${startDate}&endDate=${endDate}`
        );
        if (res.ok) {
          const data = await res.json();
          setRecords(data.records || []);
        }
      } catch (err) {
        console.error('Failed to fetch details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [stTechId, metric, startDate, endDate]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {techName}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {METRIC_LABELS[metric]} &middot; {formatDate(startDate)} &ndash; {formatDate(endDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
              <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
            </div>
          ) : records.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No records found.</p>
          ) : metric === 'gross_sales' ? (
            <GrossSalesTable records={records} />
          ) : metric === 'tgls' ? (
            <TGLsTable records={records} />
          ) : metric === 'options_per_opportunity' ? (
            <OptsPerOppTable records={records} />
          ) : metric === 'reviews' ? (
            <ReviewsTable records={records} />
          ) : metric === 'attendance' ? (
            <AttendanceTable records={records} />
          ) : (
            <MembershipsTable records={records} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 text-right text-sm" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

function GrossSalesTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'sold_on');
  const total = records.reduce((sum, r) => sum + (r.subtotal || 0), 0);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <SortHeader label="Job #" field="st_job_id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Date Sold" field="sold_on" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Estimates" field="estimate_ids" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Subtotal" field="subtotal" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} align="right" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td className="py-2"><STLink type="Job" id={r.st_job_id} /></td>
            <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.sold_on)}</td>
            <td className="py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {(r.estimate_ids || []).length} sold
            </td>
            <td className="py-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.subtotal || 0)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid var(--border-default)' }}>
          <td colSpan={3} className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>Total Sales ({records.length} closed opp{records.length !== 1 ? 's' : ''})</td>
          <td className="py-2 text-right font-mono font-bold" style={{ color: 'var(--christmas-green-light)' }}>{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function TGLsTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'created_on');
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <SortHeader label="Lead #" field="st_lead_id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Date" field="created_on" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Customer" field="customer_name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Status" field="status" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Source Job" field="source_job_id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td className="py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{r.st_lead_id}</td>
            <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.created_on)}</td>
            <td className="py-2" style={{ color: 'var(--text-primary)' }}>{r.customer_name || '—'}</td>
            <td className="py-2">
              {r.status && <span className="badge badge-hvac">{r.status}</span>}
              {!r.status && <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </td>
            <td className="py-2">
              {r.source_job_id ? <STLink type="Job" id={r.source_job_id} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReviewsTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'create_time');
  return (
    <>
      <div className="flex gap-4 mb-3 text-xs">
        <SortPill label="Date" field="create_time" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
        <SortPill label="Rating" field="star_rating" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
        <SortPill label="Reviewer" field="reviewer_name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
      </div>
      <div className="space-y-3">
        {sorted.map((r: any, i: number) => (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                {r.reviewer_name || 'Anonymous'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatDate(r.create_time)}
              </span>
            </div>
            <div className="mb-1">
              {Array.from({ length: 5 }).map((_, idx) => (
                <span key={idx} style={{ color: idx < (r.star_rating || 0) ? '#FFD700' : 'var(--text-muted)', fontSize: '14px' }}>
                  ★
                </span>
              ))}
            </div>
            {r.comment && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {r.comment.length > 300 ? r.comment.slice(0, 300) + '...' : r.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function SortPill({ label, field, sortKey, sortAsc, onSort }: {
  label: string; field: string; sortKey: string; sortAsc: boolean; onSort: (k: string) => void;
}) {
  const active = sortKey === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="px-2 py-1 rounded"
      style={{
        background: active ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
        color: active ? 'var(--christmas-green-light)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--christmas-green-dark)' : 'var(--border-subtle)'}`,
      }}
    >
      {label} {active ? (sortAsc ? '\u25B2' : '\u25BC') : '\u2195'}
    </button>
  );
}

function OptsPerOppTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'completed_date');
  const totalEstimates = records.reduce((sum, r) => sum + (r.estimate_count || 0), 0);
  const avg = records.length > 0 ? totalEstimates / records.length : 0;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <SortHeader label="Job #" field="st_job_id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Completed" field="completed_date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Customer" field="customer_name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Estimates" field="estimate_count" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} align="right" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td className="py-2"><STLink type="Job" id={r.st_job_id} /></td>
            <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.completed_date)}</td>
            <td className="py-2" style={{ color: 'var(--text-primary)' }}>{r.customer_name || '—'}</td>
            <td className="py-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{r.estimate_count || 0}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid var(--border-default)' }}>
          <td colSpan={3} className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            Average ({records.length} job{records.length !== 1 ? 's' : ''})
          </td>
          <td className="py-2 text-right font-mono font-bold" style={{ color: 'var(--christmas-green-light)' }}>
            {avg.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function MembershipsTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'sold_on');
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <SortHeader label="Membership #" field="st_membership_id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Date Sold" field="sold_on" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Type" field="membership_type_name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td className="py-2"><STLink type="Membership" id={r.st_membership_id} /></td>
            <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.sold_on)}</td>
            <td className="py-2" style={{ color: 'var(--text-primary)' }}>{r.membership_type_name || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttendanceTable({ records }: { records: any[] }) {
  const { sorted, sortKey, sortAsc, toggle } = useSort(records, 'date');
  const totalPoints = records.reduce((sum, r) => sum + (r.points || 0), 0);

  function pointsColor(pts: number): string {
    if (pts <= 0) return 'var(--status-success)';
    if (pts < 3) return 'var(--christmas-gold)';
    return 'var(--status-error)';
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <SortHeader label="Date" field="date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Type" field="type" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
          <SortHeader label="Points" field="points" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} align="right" />
          <SortHeader label="Notes" field="notes" sortKey={sortKey} sortAsc={sortAsc} onSort={toggle} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.date)}</td>
            <td className="py-2" style={{ color: 'var(--text-primary)' }}>
              {INFRACTION_CONFIG[r.type as AttendanceInfractionType]?.label || r.type}
            </td>
            <td className="py-2 text-right font-mono" style={{ color: pointsColor(r.points) }}>
              {r.points > 0 ? '+' : ''}{r.points}
            </td>
            <td className="py-2" style={{ color: 'var(--text-muted)' }}>{r.notes || '—'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid var(--border-default)' }}>
          <td colSpan={2} className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            Total ({records.length} record{records.length !== 1 ? 's' : ''})
          </td>
          <td className="py-2 text-right font-mono font-bold" style={{ color: pointsColor(totalPoints) }}>
            {totalPoints > 0 ? '+' : ''}{Math.round(totalPoints * 10) / 10}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
