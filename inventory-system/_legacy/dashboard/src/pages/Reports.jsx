/**
 * Reports — analytics dashboard
 *
 * Sections
 * ─────────
 * 1. Header + date-range / dept filter bar
 * 2. KPI cards (units consumed, value consumed, PO spend, completed batches)
 * 3. Daily consumption vs. received trend (line chart)
 * 4. Top-10 consumed materials (horizontal bar) + movement type breakdown (donut)
 * 5. Monthly PO spend by dept (grouped bar)
 * 6. Restock batch completions by month (bar)
 * 7. Tool utilization (checked-out status breakdown)
 * 8. Raw movements table with CSV export
 */

import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  subDays, subYears,
  format, parseISO,
} from 'date-fns';
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart2, TrendingDown, ShoppingCart, Package,
  RefreshCw, Download, Wrench, CheckCircle2,
} from 'lucide-react';
import Header       from '../components/Header.jsx';
import { Spinner }  from '../components/ui/Spinner.jsx';
import {
  useMovementReport, usePOReport,
  useRestockReport,  useDashboardStats,
} from '../hooks/useReports.js';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const fmtDate = (d) => format(d, 'yyyy-MM-dd');
const today   = new Date();

const RANGES = [
  { key: '7d',  label: 'Last 7 days',    start: () => subDays(today, 7)   },
  { key: '30d', label: 'Last 30 days',   start: () => subDays(today, 30)  },
  { key: '90d', label: 'Last 90 days',   start: () => subDays(today, 90)  },
  { key: '1y',  label: 'Last 12 months', start: () => subYears(today, 1)  },
];

const DEPT_OPTIONS = [
  { key: 'all',      label: 'All Depts' },
  { key: 'plumbing', label: 'Plumbing'  },
  { key: 'hvac',     label: 'HVAC'      },
];

const MOVEMENT_COLORS = {
  consumed_on_job:   '#ef4444',
  received:          '#22c55e',
  adjustment:        '#f59e0b',
  transferred:       '#3b82f6',
  loaded_to_bin:     '#8b5cf6',
  returned_to_stock: '#10b981',
};
const MOVEMENT_LABELS = {
  consumed_on_job:   'Job Consumption',
  received:          'Received (PO)',
  adjustment:        'Adjustment',
  transferred:       'Transfer',
  loaded_to_bin:     'Bin Load',
  returned_to_stock: 'Return to Stock',
};
const PIE_COLORS = ['#ef4444','#22c55e','#f59e0b','#3b82f6','#8b5cf6','#10b981','#6366f1','#06b6d4'];

const fmtCur = (n) =>
  typeof n === 'number'
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

/* ─── CSV download ─────────────────────────────────────────────────────────── */
function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]).join(',');
  const body   = rows.map(r =>
    Object.values(r).map(v => (String(v).includes(',') ? `"${v}"` : v)).join(',')
  ).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Shared section card ──────────────────────────────────────────────────── */
function Section({ title, subtitle, action, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─── Shared empty ─────────────────────────────────────────────────────────── */
function ChartEmpty({ msg = 'No data for this period' }) {
  return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">{msg}</div>
  );
}

/* ─── Dark tooltip used by all Recharts ────────────────────────────────────── */
function DarkTip({ active, payload, label, prefix = '', suffix = '', valueKey }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? '#fff' }}>
          {p.name ?? p.dataKey}:{' '}
          <span className="font-semibold">
            {prefix}{(p.value ?? 0).toLocaleString()}{suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ─── Axis style ───────────────────────────────────────────────────────────── */
const AXIS = { fill: '#94a3b8', fontSize: 11 };
const GRID = { stroke: '#e2e8f0', strokeDasharray: '3 3' };

/* ─── KPI card ─────────────────────────────────────────────────────────────── */
function KPI({ icon: Icon, label, value, sub, iconCls, bgCls }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${bgCls}`}>
        <Icon className={`w-5 h-5 ${iconCls}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 tabular-nums truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────────── */
export default function Reports() {
  const { collapsed, onToggleSidebar } = useOutletContext();

  const [rangeKey, setRangeKey] = useState('30d');
  const [dept,     setDept]     = useState('all');

  const range     = RANGES.find(r => r.key === rangeKey) ?? RANGES[1];
  const startDate = fmtDate(range.start());
  const endDate   = fmtDate(today);

  const { movements, loading: mvLoading, refresh: mvRefresh } =
    useMovementReport({ startDate, endDate });
  const { orders,  loading: poLoading  } = usePOReport();
  const { batches, loading: bkLoading  } = useRestockReport();
  const { stats                         } = useDashboardStats();

  const loading = mvLoading || poLoading || bkLoading;

  /* ── filter movements by dept ── */
  const filteredMv = useMemo(() => {
    if (dept === 'all') return movements;
    return movements.filter(m =>
      (m.department ?? '').toLowerCase() === dept
    );
  }, [movements, dept]);

  /* ── KPI derivations ── */
  const consumed = useMemo(() =>
    filteredMv.filter(m => m.movement_type === 'consumed_on_job'), [filteredMv]);

  const totalUnitsConsumed = consumed.reduce((s, m) => s + (m.quantity ?? 0), 0);
  const totalValueConsumed = consumed.reduce((s, m) => s + (m.total_value ?? 0), 0);

  const completedPOs   = orders.filter(o => o.status === 'received');
  const totalPOSpend   = completedPOs.reduce((s, o) => s + (o.total_value ?? 0), 0);
  const completedBatches = batches.filter(b => b.status === 'completed');

  /* ── Daily consumption trend ── */
  const dailyData = useMemo(() => {
    const map = {};
    for (const m of filteredMv) {
      const day = (m.created_at ?? '').slice(0, 10);
      if (!day) continue;
      if (!map[day]) map[day] = { date: day, consumed: 0, received: 0 };
      if (m.movement_type === 'consumed_on_job') map[day].consumed += (m.quantity ?? 0);
      if (m.movement_type === 'received')         map[day].received += (m.quantity ?? 0);
    }
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: (() => {
          try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; }
        })(),
      }));
  }, [filteredMv]);

  /* ── Top consumed materials ── */
  const topMaterials = useMemo(() => {
    const map = {};
    for (const m of consumed) {
      const key = m.material_id ?? m.sku ?? 'unknown';
      if (!map[key]) map[key] = { name: m.material_name ?? m.sku ?? key, qty: 0, value: 0 };
      map[key].qty   += (m.quantity ?? 0);
      map[key].value += (m.total_value ?? 0);
    }
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(r => ({ ...r, name: r.name.length > 26 ? r.name.slice(0, 26) + '…' : r.name }));
  }, [consumed]);

  /* ── Movement type breakdown ── */
  const typeBreakdown = useMemo(() => {
    const map = {};
    for (const m of filteredMv) {
      const t = m.movement_type ?? 'unknown';
      map[t] = (map[t] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([type, count]) => ({ name: MOVEMENT_LABELS[type] ?? type, value: count, type }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMv]);

  /* ── Monthly PO spend by dept ── */
  const monthlyPO = useMemo(() => {
    const map = {};
    for (const o of orders) {
      const raw = o.created_at ?? '';
      if (!raw) continue;
      try {
        const month = format(parseISO(raw.slice(0, 10)), 'yyyy-MM');
        if (!map[month]) map[month] = { month, plumbing: 0, hvac: 0 };
        const dept = o.department ?? 'other';
        if (dept === 'plumbing') map[month].plumbing += (o.total_value ?? 0);
        else if (dept === 'hvac') map[month].hvac    += (o.total_value ?? 0);
      } catch { /* skip */ }
    }
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(d => ({
        ...d,
        label: (() => {
          try { return format(parseISO(d.month + '-01'), 'MMM yy'); } catch { return d.month; }
        })(),
      }));
  }, [orders]);

  /* ── Restock batch completions by month ── */
  const batchCadence = useMemo(() => {
    const map = {};
    for (const b of batches) {
      const raw = b.completed_at ?? b.created_at ?? '';
      if (!raw) continue;
      try {
        const month = format(parseISO(raw.slice(0, 10)), 'yyyy-MM');
        if (!map[month]) map[month] = { month, plumbing: 0, hvac: 0 };
        const dept = b.department ?? 'other';
        if (b.status === 'completed') {
          if (dept === 'plumbing') map[month].plumbing++;
          else if (dept === 'hvac') map[month].hvac++;
        }
      } catch { /* skip */ }
    }
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(d => ({
        ...d,
        label: (() => {
          try { return format(parseISO(d.month + '-01'), 'MMM yy'); } catch { return d.month; }
        })(),
      }));
  }, [batches]);

  /* ── Tech consumption leaderboard ── */
  const techConsumption = useMemo(() => {
    const map = {};
    for (const m of consumed) {
      const name = m.performed_by ?? 'Unknown';
      if (!map[name]) map[name] = { name, qty: 0, value: 0 };
      map[name].qty   += (m.quantity ?? 0);
      map[name].value += (m.total_value ?? 0);
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [consumed]);

  /* ── CSV export ── */
  function exportMovements() {
    downloadCSV(
      filteredMv.map(m => ({
        date:         (m.created_at ?? '').slice(0, 10),
        type:         m.movement_type ?? '',
        sku:          m.sku ?? '',
        material:     m.material_name ?? '',
        qty:          m.quantity ?? 0,
        unit_cost:    m.unit_cost ?? '',
        total_value:  m.total_value ?? '',
        location:     m.location_name ?? '',
        dept:         m.department ?? '',
        performed_by: m.performed_by ?? '',
      })),
      `movements-${startDate}-to-${endDate}.csv`
    );
  }

  /* ── Toolbar ── */
  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Range pills */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              rangeKey === r.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {r.key === '1y' ? '1Y' : r.key.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Dept pills */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        {DEPT_OPTIONS.map(d => (
          <button
            key={d.key}
            onClick={() => setDept(d.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              dept === d.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={mvRefresh}
        title="Refresh"
        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <button
        onClick={exportMovements}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
                   text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
    </div>
  );

  return (
    <>
      <Header
        title="Reports & Analytics"
        subtitle={`${range.label} · ${startDate} → ${endDate}`}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={toolbar}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center h-48">
            <Spinner size="lg" className="text-indigo-400" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI
                icon={TrendingDown}
                label="Units Consumed"
                value={totalUnitsConsumed.toLocaleString()}
                sub={`${consumed.length} job events`}
                bgCls="bg-red-50" iconCls="text-red-500"
              />
              <KPI
                icon={Package}
                label="Value Consumed"
                value={fmtCur(totalValueConsumed)}
                sub="materials used on jobs"
                bgCls="bg-amber-50" iconCls="text-amber-500"
              />
              <KPI
                icon={ShoppingCart}
                label="PO Spend (received)"
                value={fmtCur(totalPOSpend)}
                sub={`${completedPOs.length} received orders`}
                bgCls="bg-emerald-50" iconCls="text-emerald-500"
              />
              <KPI
                icon={BarChart2}
                label="Restock Batches"
                value={completedBatches.length.toString()}
                sub={`of ${batches.length} total`}
                bgCls="bg-indigo-50" iconCls="text-indigo-500"
              />
            </div>

            {/* ── Daily trend ── */}
            <Section
              title="Daily Consumption vs. Received"
              subtitle={range.label}
            >
              {dailyData.length === 0 ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" />
                    <YAxis tick={AXIS} />
                    <Tooltip content={<DarkTip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }}
                      formatter={v => v === 'consumed' ? 'Consumed' : 'Received'} />
                    <Line type="monotone" dataKey="consumed" name="consumed"
                      stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="received" name="received"
                      stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* ── Top materials + movement breakdown ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Top consumed */}
              <Section title="Top 10 Consumed Materials" subtitle="By units, for selected period">
                {topMaterials.length === 0 ? <ChartEmpty msg="No consumption data" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={topMaterials}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid {...GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} />
                      <YAxis type="category" dataKey="name" tick={AXIS} width={120} />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                              <p className="text-slate-300 font-medium mb-1">{label}</p>
                              <p className="text-red-400">Units: <span className="font-semibold">{payload[0]?.value?.toLocaleString()}</span></p>
                              <p className="text-amber-400">Value: <span className="font-semibold">{fmtCur(payload[0]?.payload?.value)}</span></p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="qty" fill="#ef4444" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Section>

              {/* Movement type breakdown */}
              <Section title="Movement Type Breakdown" subtitle="Count of all movements in period">
                {typeBreakdown.length === 0 ? <ChartEmpty /> : (
                  <div className="space-y-3">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie
                          data={typeBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={82}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {typeBreakdown.map((entry, i) => (
                            <Cell
                              key={entry.type}
                              fill={MOVEMENT_COLORS[entry.type] ?? PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) =>
                            active && payload?.length ? (
                              <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                                <p style={{ color: MOVEMENT_COLORS[payload[0].payload.type] ?? '#fff' }}>
                                  {payload[0].name}:{' '}
                                  <span className="font-semibold">{payload[0].value?.toLocaleString()}</span>
                                </p>
                              </div>
                            ) : null
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {typeBreakdown.map((d, i) => {
                        const color = MOVEMENT_COLORS[d.type] ?? PIE_COLORS[i % PIE_COLORS.length];
                        const total = typeBreakdown.reduce((s, x) => s + x.value, 0);
                        return (
                          <div key={d.type} className="flex items-center gap-1.5 text-xs truncate">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-slate-600 truncate">{d.name}</span>
                            <span className="ml-auto text-slate-400 pl-1 tabular-nums">
                              {d.value} · {Math.round(d.value / total * 100)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* ── Monthly PO spend + restock cadence ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Monthly PO spend by dept */}
              <Section title="Monthly PO Spend by Department" subtitle="All time, last 12 months">
                {monthlyPO.length === 0 ? <ChartEmpty msg="No purchase order data" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyPO} margin={{ top: 4, right: 8, bottom: 0, left: -4 }} barSize={12}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" tick={AXIS} />
                      <YAxis tick={AXIS} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                              <p className="text-slate-400 mb-1">{label}</p>
                              {payload.map((p, i) => (
                                <p key={i} style={{ color: p.fill }}>
                                  {p.name}: <span className="font-semibold">{fmtCur(p.value)}</span>
                                </p>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                      <Bar dataKey="plumbing" name="Plumbing" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="hvac"     name="HVAC"     fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Section>

              {/* Restock batch completions */}
              <Section title="Restock Completions by Month" subtitle="Completed batches, last 12 months">
                {batchCadence.length === 0 ? <ChartEmpty msg="No restock data" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={batchCadence} margin={{ top: 4, right: 8, bottom: 0, left: -4 }} barSize={12}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" tick={AXIS} />
                      <YAxis tick={AXIS} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                              <p className="text-slate-400 mb-1">{label}</p>
                              {payload.map((p, i) => (
                                <p key={i} style={{ color: p.fill }}>
                                  {p.name}: <span className="font-semibold">{p.value}</span>
                                </p>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                      <Bar dataKey="plumbing" name="Plumbing" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="hvac"     name="HVAC"     fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Section>
            </div>

            {/* ── Tech consumption leaderboard ── */}
            <Section title="Consumption by Technician" subtitle="Units pulled on jobs, selected period">
              {techConsumption.length === 0 ? <ChartEmpty msg="No consumption data" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={techConsumption} margin={{ top: 4, right: 8, bottom: 0, left: -4 }} barSize={28}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" tick={AXIS} />
                    <YAxis tick={AXIS} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                            <p className="text-slate-300 font-medium mb-1">{label}</p>
                            <p className="text-indigo-400">Units: <span className="font-semibold">{payload[0]?.value?.toLocaleString()}</span></p>
                            <p className="text-amber-400">Value: <span className="font-semibold">{fmtCur(payload[0]?.payload?.value)}</span></p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="qty" name="Units Consumed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* ── Raw movements table ── */}
            <Section
              title="Movement Log"
              subtitle={`${filteredMv.length.toLocaleString()} records in period`}
              action={
                <button
                  onClick={exportMovements}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              }
            >
              {filteredMv.length === 0 ? (
                <ChartEmpty msg="No movements in this period" />
              ) : (
                <div className="overflow-x-auto -mx-5 -mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Date','Type','SKU / Material','Qty','Location','Dept','By'].map(h => (
                          <th key={h}
                            className="text-left text-xs text-slate-400 font-medium py-2 px-5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMv.slice(0, 100).map((m, i) => {
                        const color = MOVEMENT_COLORS[m.movement_type] ?? '#94a3b8';
                        return (
                          <tr key={m.id ?? i}
                            className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors">
                            <td className="py-2 px-5 text-slate-400 whitespace-nowrap text-xs">
                              {(m.created_at ?? '').slice(0, 10)}
                            </td>
                            <td className="py-2 px-5 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                <span className="text-xs text-slate-600">
                                  {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                                </span>
                              </span>
                            </td>
                            <td className="py-2 px-5 text-slate-800 max-w-[200px] truncate">
                              <span className="text-xs">{m.material_name ?? m.sku ?? '—'}</span>
                            </td>
                            <td className="py-2 px-5 text-slate-700 text-right tabular-nums text-xs">
                              {m.quantity?.toLocaleString() ?? '—'}
                            </td>
                            <td className="py-2 px-5 text-slate-400 whitespace-nowrap text-xs">
                              {m.location_name ?? '—'}
                            </td>
                            <td className="py-2 px-5 text-slate-400 capitalize text-xs">
                              {m.department ?? '—'}
                            </td>
                            <td className="py-2 px-5 text-slate-400 whitespace-nowrap text-xs">
                              {m.performed_by ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredMv.length > 100 && (
                    <p className="text-slate-400 text-xs text-center py-3 border-t border-slate-50">
                      Showing 100 of {filteredMv.length.toLocaleString()} — export CSV for full dataset
                    </p>
                  )}
                </div>
              )}
            </Section>

          </>
        )}

      </main>
    </>
  );
}
