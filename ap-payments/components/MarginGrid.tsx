'use client';

import { formatCurrency } from '@/lib/ap-utils';

export interface MarginAdjustment {
  id: string;
  bucket: string;
  amount: number;
  label: string | null;
  source: string;
  note: string | null;
  created_at: string;
}

/** One row from GET /api/margin (job identity + computeAdjustedMargin result + adjustments). */
export interface MarginRow {
  id: string;
  job_number: string;
  customer_name: string | null;
  trade: string | null;
  job_type: string | null;
  assignment_type: string | null;
  contractor_name: string | null;
  completed_date: string | null;
  group: string;
  cost_status: 'synced' | 'pending' | 'contractor_pending';
  revenue: number | null;
  stTotalCost: number | null;
  stGrossMargin: number | null;
  stGrossMarginPct: number | null;
  equipmentCost: number;
  materialCost: number;
  laborCost: number;
  softCost: number;
  overheadCost: number;
  stOtherCost: number;
  contractorLabor: number;
  manualAdjustmentTotal: number;
  adjustedTotalCost: number | null;
  adjustedGrossMargin: number | null;
  adjustedGrossMarginPct: number | null;
  adjustments: MarginAdjustment[];
}

const pct = (f: number | null) => (f == null ? '—' : `${(f * 100).toFixed(1)}%`);

function marginColor(f: number | null): string {
  if (f == null) return 'var(--text-muted)';
  if (f < 0.1) return '#f85149';
  if (f < 0.25) return '#d29922';
  return '#4ade80';
}

function HeaderCell({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
    >
      {children}
    </th>
  );
}

function Cell({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td
      className={`px-3 py-2 text-sm ${right ? 'text-right tabular-nums' : 'text-left'}`}
      style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}
    >
      {children}
    </td>
  );
}

function JobRow({ row, onClick }: { row: MarginRow; onClick: () => void }) {
  const subbed = row.assignment_type === 'contractor' && row.contractorLabor > 0;
  const unpriced = row.cost_status !== 'synced';
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-white/5"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <Cell>
        <span style={{ color: 'var(--text-primary)' }}>{row.customer_name || '—'}</span>
        {row.manualAdjustmentTotal !== 0 && (
          <span className="ml-1.5 text-xs" style={{ color: 'var(--christmas-green)' }} title="Has manual adjustments">●</span>
        )}
      </Cell>
      <Cell muted>{row.job_number}</Cell>
      <Cell>
        {subbed && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(163,113,247,0.15)', color: '#a371f7' }}>subbed</span>}
        {row.cost_status === 'pending' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(210,153,34,0.15)', color: '#d29922' }}>costs pending</span>}
        {row.cost_status === 'contractor_pending' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(210,153,34,0.15)', color: '#d29922' }}>rate pending</span>}
      </Cell>
      <Cell right>{unpriced ? '—' : formatCurrency(row.revenue)}</Cell>
      <Cell right muted>{unpriced ? '—' : formatCurrency(row.equipmentCost)}</Cell>
      <Cell right muted>{unpriced ? '—' : formatCurrency(row.materialCost)}</Cell>
      <Cell right>
        {unpriced ? '—' : (
          <span style={{ color: 'var(--text-secondary)' }}>
            {formatCurrency(row.laborCost)}
            {row.contractorLabor > 0 && (
              <span className="text-xs ml-1" style={{ color: '#a371f7' }}>+{formatCurrency(row.contractorLabor)}</span>
            )}
          </span>
        )}
      </Cell>
      <Cell right>{unpriced ? '—' : formatCurrency(row.adjustedTotalCost)}</Cell>
      <Cell right muted>{pct(row.stGrossMarginPct)}</Cell>
      <td className="px-3 py-2 text-sm text-right tabular-nums font-semibold" style={{ color: marginColor(row.adjustedGrossMarginPct), whiteSpace: 'nowrap' }}>
        {unpriced ? '—' : pct(row.adjustedGrossMarginPct)}
      </td>
    </tr>
  );
}

export default function MarginGrid({
  rows,
  grouped,
  onRowClick,
}: {
  rows: MarginRow[];
  grouped: boolean;
  onRowClick: (row: MarginRow) => void;
}) {
  const header = (
    <thead>
      <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <HeaderCell>Customer</HeaderCell>
        <HeaderCell>Job #</HeaderCell>
        <HeaderCell> </HeaderCell>
        <HeaderCell right>Revenue</HeaderCell>
        <HeaderCell right>Equip</HeaderCell>
        <HeaderCell right>Material</HeaderCell>
        <HeaderCell right>Labor</HeaderCell>
        <HeaderCell right>Adj Cost</HeaderCell>
        <HeaderCell right>ST GM%</HeaderCell>
        <HeaderCell right>Adj GM%</HeaderCell>
      </tr>
    </thead>
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-lg p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        No jobs in this period.
      </div>
    );
  }

  // Group rendering
  const groups = grouped
    ? Array.from(new Set(rows.map((r) => r.group))).sort()
    : [''];

  const subtotal = (groupRows: MarginRow[]) => {
    const priced = groupRows.filter((r) => r.cost_status === 'synced' && (r.revenue ?? 0) > 0);
    const rev = priced.reduce((s, r) => s + (r.revenue || 0), 0);
    const cost = priced.reduce((s, r) => s + (r.adjustedTotalCost || 0), 0);
    return { rev, cost, gm: rev - cost, gmPct: rev > 0 ? (rev - cost) / rev : null, count: groupRows.length };
  };

  return (
    <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <table className="w-full min-w-[760px]">
        {header}
        <tbody>
          {groups.map((g) => {
            const groupRows = grouped ? rows.filter((r) => r.group === g) : rows;
            const st = subtotal(groupRows);
            return (
              <>
                {grouped && (
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {g || '—'} <span style={{ color: 'var(--text-muted)' }}>({st.count})</span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{formatCurrency(st.rev)}</td>
                    <td colSpan={3}></td>
                    <td className="px-3 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{formatCurrency(st.cost)}</td>
                    <td></td>
                    <td className="px-3 py-1.5 text-xs text-right tabular-nums font-semibold" style={{ color: marginColor(st.gmPct) }}>{pct(st.gmPct)}</td>
                  </tr>
                )}
                {groupRows.map((r) => (
                  <JobRow key={r.id} row={r} onClick={() => onRowClick(r)} />
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
