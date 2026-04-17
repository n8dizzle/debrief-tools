/**
 * Dashboard — command-center overview for Christmas Air inventory ops.
 *
 * Layout:
 *   1. KPI cards row (4 cards with sub-stats)
 *   2. Stock health donut + restock pipeline funnel + quick actions
 *   3. Alert feed (critical/warning notifications)
 *   4. Materials needing reorder | Recent activity feed
 *   5. Open POs with ST sync | Locked restock batches
 */

import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, ShoppingCart, Wrench, Package,
  ClipboardList, ExternalLink, RotateCcw, CheckCircle2, Clock,
  TruckIcon, Zap, Bell, Activity, ArrowRight, PackageCheck,
  Send, FileText, Flag, ChevronRight, Warehouse,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import Header   from '../components/Header.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Badge    from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import { useDashboard } from '../hooks/useDashboard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCur = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function countByStatus(arr = [], status) {
  return arr.find(r => r.status === status)?.count ?? 0;
}

// ── ST sync strip ─────────────────────────────────────────────────────────────
function STSyncStrip({ stats }) {
  if (!stats?.st_last_sync) return null;
  const ok = stats.st_sync_status === 'ok';
  return (
    <div className="flex items-center gap-2 px-6 py-1.5 bg-slate-800/5 border-b border-slate-200/80">
      <span className="text-[11px] text-slate-400 font-medium">ServiceTitan:</span>
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className={`font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
          {ok ? 'Synced' : 'Sync issue'}
        </span>
        <span className="text-slate-400">
          · last sync {formatDistanceToNow(new Date(stats.st_last_sync), { addSuffix: true })}
        </span>
      </span>
    </div>
  );
}

// ── Stock health donut ────────────────────────────────────────────────────────
const DONUT_COLORS = { ok: '#10b981', low: '#f59e0b', oos: '#ef4444' };

function StockHealthDonut({ stats, loading }) {
  const oos        = Number(stats?.oos_materials   ?? 1);
  const low        = Number(stats?.low_materials   ?? 3);
  const totalSkus  = Number(stats?.total_materials ?? 10);
  const ok         = Math.max(0, totalSkus - oos - low);
  const chartTotal = ok + low + oos || 1;

  const data = [
    { name: 'OK',    value: ok,  color: DONUT_COLORS.ok  },
    { name: 'Low',   value: low, color: DONUT_COLORS.low },
    { name: 'Empty', value: oos, color: DONUT_COLORS.oos },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5" /> Stock Health
      </p>
      {loading ? (
        <div className="h-28 bg-slate-50 rounded-xl animate-pulse" />
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={28} outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [`${v} SKUs`, n]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {name}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(value / chartTotal) * 100}%`, background: color }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-700 w-6 text-right">{value}</span>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 pt-1">{totalSkus} total SKUs tracked</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PO Spend bar chart ────────────────────────────────────────────────────────
function SpendByDept({ openPOs, loading }) {
  const depts = ['plumbing', 'hvac'];
  const data = depts.map(d => ({
    dept: d.charAt(0).toUpperCase() + d.slice(1),
    spend: openPOs
      .filter(p => p.department === d)
      .reduce((s, p) => s + Number(p.total_amount ?? p.total_value ?? p.total ?? 0), 0),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <ShoppingCart className="w-3.5 h-3.5" /> Open PO Spend by Dept
      </p>
      {loading ? (
        <div className="h-28 bg-slate-50 rounded-xl animate-pulse" />
      ) : (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={28} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip
                formatter={v => [fmtCur.format(v), 'Spend']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                <Cell fill="#6366f1" />
                <Cell fill="#f59e0b" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Restock pipeline (horizontal strip) ──────────────────────────────────────
function RestockPipeline({ allBatches, loading }) {
  const steps = [
    { key: 'collecting', label: 'Collecting', dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
    { key: 'locked',     label: 'Needs Review',dot:'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' },
    { key: 'approved',   label: 'Approved',   dot: 'bg-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
    { key: 'picked',     label: 'Picked',     dot: 'bg-purple-400',  text: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-100' },
    { key: 'completed',  label: 'Completed',  dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Restock Pipeline
        </p>
      </div>
      {loading ? (
        <div className="flex gap-2">
          {steps.map(s => <div key={s.key} className="flex-1 h-12 bg-slate-50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="flex gap-2">
          {steps.map(({ key, label, dot, text, bg, border }, i) => {
            const count = countByStatus(allBatches, key);
            return (
              <div key={key} className={`flex-1 flex flex-col items-center justify-center gap-1
                                        rounded-lg border px-2 py-2 ${bg} ${border}`}>
                <span className={`text-lg font-bold tabular-nums leading-none ${text}`}>{count}</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500 text-center leading-tight">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────
function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { label: 'Run PO',          sub: 'Generate weekly orders',   icon: Zap,          path: null, action: 'run-po',      color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { label: 'Restock Queue',   sub: 'Review pending batches',   icon: RefreshCw,    path: '/restock-queue',             color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { label: 'Receive Delivery',sub: 'Open mobile receiver',     icon: PackageCheck, path: '/scanner/receive',           color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { label: 'New Emergency PO',sub: 'Create urgent order',      icon: ShoppingCart, path: '/purchase-orders',           color: 'text-red-600 bg-red-50 border-red-100' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" /> Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ label, sub, icon: Icon, path, color }) => (
          <button
            key={label}
            onClick={() => path && navigate(path)}
            className={`flex items-center gap-2 text-left p-2.5 rounded-xl border
                        hover:opacity-80 active:scale-95 transition-all ${color}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{label}</p>
              <p className="text-[10px] opacity-60 truncate">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Alert feed ────────────────────────────────────────────────────────────────
const SEVERITY_CFG = {
  critical: { bar: 'bg-red-500',   icon: AlertTriangle, iconCls: 'text-red-500',   bg: 'bg-red-50/60',   badge: 'bg-red-100 text-red-700' },
  warning:  { bar: 'bg-amber-400', icon: AlertTriangle, iconCls: 'text-amber-500', bg: 'bg-amber-50/40', badge: 'bg-amber-100 text-amber-700' },
  info:     { bar: 'bg-blue-400',  icon: Bell,          iconCls: 'text-blue-400',  bg: '',               badge: 'bg-blue-100 text-blue-700' },
};

function AlertFeed({ notifications, loading, navigate }) {
  // Show unread first, then top alerts, max 6
  const alerts = [...notifications]
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
    })
    .slice(0, 6);

  if (!loading && alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          Alerts
          {alerts.filter(a => !a.read).length > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[11px] font-bold rounded-full">
              {alerts.filter(a => !a.read).length} new
            </span>
          )}
        </p>
        <button
          onClick={() => navigate('/notifications')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          All alerts <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
              <div className="w-1 h-8 bg-slate-100 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded w-2/3" />
                <div className="h-2.5 bg-slate-50 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {alerts.map(alert => {
            const cfg = SEVERITY_CFG[alert.severity] ?? SEVERITY_CFG.info;
            const Icon = cfg.icon;
            return (
              <button
                key={alert.id}
                onClick={() => alert.link && navigate(alert.link)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left
                            hover:bg-slate-50 transition-colors ${alert.read ? 'opacity-70' : ''}`}
              >
                <div className={`w-1 self-stretch rounded-full shrink-0 ${cfg.bar}`} />
                <Icon className={`w-4 h-4 shrink-0 ${cfg.iconCls}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-slate-700 truncate ${!alert.read ? 'font-semibold' : ''}`}>
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{alert.message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Materials below reorder ───────────────────────────────────────────────────
function MaterialsAlert({ items, loading, navigate }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Needs Reorder
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full">
            {items.length}
          </span>
        </p>
        <button
          onClick={() => navigate('/materials?below_reorder=true')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          View all <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <table className="data-table"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}</tbody></table>
        ) : items.length === 0 ? (
          <EmptyState title="All stocked up" message="No materials below reorder point" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Dept</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">Reorder At</th>
              </tr>
            </thead>
            <tbody>
              {items.map(m => (
                <tr
                  key={m.id}
                  className="cursor-pointer hover:bg-indigo-50/30"
                  onClick={() => navigate(`/materials/${m.id}`)}
                >
                  <td>
                    <p className="font-medium text-slate-800 truncate max-w-[180px]">{m.name}</p>
                    {m.sku && <p className="text-[11px] text-slate-400 font-mono">{m.sku}</p>}
                  </td>
                  <td><Badge status={m.department}>{m.department}</Badge></td>
                  <td className="text-right font-mono text-sm">
                    <span className={Number(m.qty_on_hand ?? m.total_warehouse_stock) === 0 ? 'text-red-600 font-bold' : 'text-amber-600 font-semibold'}>
                      {Number(m.qty_on_hand ?? m.total_warehouse_stock ?? 0)}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm text-slate-400">
                    {m.reorder_point ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────
const MOVE_CFG = {
  consumed_on_job:      { icon: Package,      iconCls: 'text-red-400',     label: 'Consumed' },
  received:             { icon: PackageCheck, iconCls: 'text-emerald-500', label: 'Received' },
  adjustment:           { icon: RefreshCw,    iconCls: 'text-blue-400',    label: 'Adjusted' },
  transferred:          { icon: TruckIcon,    iconCls: 'text-indigo-400',  label: 'Transferred' },
  loaded_to_bin:        { icon: Warehouse,    iconCls: 'text-purple-400',  label: 'Loaded to Bin' },
  returned_to_stock:    { icon: Activity,     iconCls: 'text-slate-400',   label: 'Returned' },
};

function ActivityFeed({ movements, loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          Recent Activity
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : movements.length === 0 ? (
          <EmptyState icon={Activity} title="No recent activity" message="Movements will appear here" />
        ) : (
          <div className="divide-y divide-slate-50">
            {movements.map(m => {
              const cfg = MOVE_CFG[m.movement_type] ?? MOVE_CFG.adjustment;
              const Icon = cfg.icon;
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Icon className={`w-3.5 h-3.5 ${cfg.iconCls}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      <span className="font-semibold">{cfg.label}</span>
                      {' · '}{m.material_name ?? m.sku ?? 'Unknown material'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      {m.location_name ? ` · ${m.location_name}` : ''}
                      {m.performed_by  ? ` · ${m.performed_by}`  : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(m.created_at ?? m.timestamp ?? Date.now()), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Open POs ──────────────────────────────────────────────────────────────────
function OpenPOs({ pos, loading, navigate }) {
  const open = pos.filter(p => ['draft', 'sent', 'partially_received', 'pending_review'].includes(p.status));

  const poStatusIcon = {
    draft:              <FileText className="w-3 h-3 text-slate-400" />,
    sent:               <Send className="w-3 h-3 text-blue-400" />,
    partially_received: <PackageCheck className="w-3 h-3 text-amber-400" />,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-500" />
          Open POs
          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[11px] font-bold rounded-full">{open.length}</span>
        </p>
        <button
          onClick={() => navigate('/purchase-orders')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          Manage <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {loading ? (
        <table className="data-table"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody></table>
      ) : open.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No open POs" message="All purchase orders are received or cancelled" />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Vendor</th>
              <th>ST PO#</th>
              <th className="text-right">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {open.map(po => (
              <tr
                key={po.id}
                className="cursor-pointer hover:bg-indigo-50/30"
                onClick={() => navigate(`/purchase-orders/${po.id}`)}
              >
                <td className="font-mono text-xs text-slate-600">{po.po_number}</td>
                <td>
                  <p className="text-sm text-slate-700 truncate max-w-[130px]">
                    {po.supply_house_name ?? po.vendor ?? '—'}
                  </p>
                </td>
                <td>
                  {po.st_po_number
                    ? <span className="flex items-center gap-1 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${po.st_sync_status === 'synced' ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                        <span className="font-mono text-slate-500">{po.st_po_number}</span>
                      </span>
                    : <span className="text-xs text-slate-300">—</span>
                  }
                </td>
                <td className="text-right font-mono text-sm font-semibold text-slate-800">
                  {fmtCur.format(Number(po.total_amount ?? po.total_value ?? po.total ?? 0))}
                </td>
                <td>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {poStatusIcon[po.status]}
                    {po.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Locked restock batches ────────────────────────────────────────────────────
function LockedBatches({ batches, loading, navigate }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" />
          Awaiting Review
          {batches.length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full animate-pulse">
              {batches.length}
            </span>
          )}
        </p>
        <button
          onClick={() => navigate('/restock-queue?status=locked')}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          Queue <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {loading ? (
        <table className="data-table"><tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}</tbody></table>
      ) : batches.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing to review" message="All restock batches are processing" />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Dept</th>
              <th className="text-right">Items</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b.id} className="cursor-pointer hover:bg-indigo-50/30" onClick={() => navigate(`/restock-queue/${b.id}`)}>
                <td>
                  <p className="font-mono text-xs text-slate-700">{b.batch_number}</p>
                  <p className="text-[11px] text-slate-400">{b.warehouse_name}</p>
                </td>
                <td><Badge status={b.department}>{b.department}</Badge></td>
                <td className="text-right tabular-nums font-medium text-slate-800">
                  {b.item_count}
                </td>
                <td className="text-xs text-slate-400 whitespace-nowrap">
                  {b.created_at ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true }) : '—'}
                </td>
                <td>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { data, loading, error, refresh, lastRefresh } = useDashboard();
  const navigate = useNavigate();

  const stats         = data?.stats          ?? null;
  const belowReorder  = data?.belowReorder   ?? [];
  const lockedBatches = data?.lockedBatches  ?? [];
  const allBatches    = data?.allBatches     ?? [];
  const openPOs       = data?.openPOs        ?? [];
  const checkedOut    = data?.checkedOutTools ?? [];
  const notifications = data?.notifications  ?? [];
  const movements     = data?.movements      ?? [];

  // KPI derivations
  const oosCount    = belowReorder.filter(m => Number(m.qty_on_hand ?? m.total_warehouse_stock ?? 0) === 0).length;
  const lowCount    = belowReorder.length - oosCount;
  const openPOCount = openPOs.filter(p => ['draft','sent','partially_received'].includes(p.status)).length;
  const poValue     = openPOs.reduce((s, p) => s + Number(p.total_amount ?? p.total_value ?? p.total ?? 0), 0);
  const overdueTools = checkedOut.filter(t => t.expected_return_date && new Date(t.expected_return_date) < new Date()).length;
  const batchCount  = lockedBatches.length;

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Christmas Air — Lewisville (Plumbing) + Argyle (HVAC)"
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                       px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <STSyncStrip stats={stats} />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Failed to load some data — backend may be unreachable.
            <button onClick={refresh} className="ml-auto text-red-600 hover:text-red-800 font-medium text-xs underline">Retry</button>
          </div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Below Reorder"
            value={loading ? undefined : belowReorder.length}
            icon={<AlertTriangle className="w-5 h-5" />}
            colorClass={belowReorder.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
            loading={loading}
            trendLabel={oosCount > 0 ? `${oosCount} out of stock · ${lowCount} low` : lowCount > 0 ? `${lowCount} running low` : 'All levels OK'}
            onClick={() => navigate('/materials?below_reorder=true')}
          />
          <StatCard
            title="Open POs"
            value={loading ? undefined : openPOCount}
            icon={<ShoppingCart className="w-5 h-5" />}
            colorClass="bg-emerald-100 text-emerald-600"
            loading={loading}
            trendLabel={poValue > 0 ? `${fmtCur.format(poValue)} outstanding` : 'No outstanding spend'}
            onClick={() => navigate('/purchase-orders')}
          />
          <StatCard
            title="Tools Out"
            value={loading ? undefined : checkedOut.length}
            icon={<Wrench className="w-5 h-5" />}
            colorClass={overdueTools > 0 ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}
            loading={loading}
            trendLabel={overdueTools > 0 ? `${overdueTools} overdue for return` : 'All on schedule'}
            trend={overdueTools > 0 ? overdueTools : undefined}
            onClick={() => navigate('/tools?status=checked_out')}
          />
          <StatCard
            title="Awaiting Review"
            value={loading ? undefined : batchCount}
            icon={<ClipboardList className="w-5 h-5" />}
            colorClass={batchCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}
            loading={loading}
            trendLabel={batchCount > 0 ? 'Restock batches locked' : 'Queue is clear'}
            onClick={() => navigate('/restock-queue?status=locked')}
          />
        </div>

        {/* ── Insight row: donut + spend by dept + quick actions ─────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StockHealthDonut stats={stats}      loading={loading} />
          <SpendByDept      openPOs={openPOs}  loading={loading} />
          <QuickActions />
        </div>

        {/* ── Restock pipeline ───────────────────────────────────────────── */}
        <RestockPipeline allBatches={allBatches} loading={loading} />

        {/* ── Alert feed ────────────────────────────────────────────────── */}
        <AlertFeed notifications={notifications} loading={loading} navigate={navigate} />

        {/* ── Materials + Activity ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" style={{ minHeight: 320 }}>
          <MaterialsAlert items={belowReorder} loading={loading} navigate={navigate} />
          <ActivityFeed   movements={movements} loading={loading} />
        </div>

        {/* ── Open POs + Locked Batches ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" style={{ minHeight: 260 }}>
          <OpenPOs      pos={openPOs}         loading={loading} navigate={navigate} />
          <LockedBatches batches={lockedBatches} loading={loading} navigate={navigate} />
        </div>

        {/* Timestamp */}
        {lastRefresh && (
          <p className="text-center text-[11px] text-slate-400 pb-2">
            <Clock className="inline w-3 h-3 mr-1 align-text-bottom" />
            Last updated {format(lastRefresh, 'h:mm:ss a')} · auto-refreshes every 60 s
          </p>
        )}

      </main>
    </>
  );
}
