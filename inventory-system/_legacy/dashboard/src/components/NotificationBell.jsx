/**
 * NotificationBell — header bell icon + dropdown notification panel.
 *
 * Receives the notifications state from the useNotifications hook via props
 * so the parent (Header) controls polling and can share the state if needed.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, CheckCheck, AlertTriangle, AlertCircle,
  Info, Package, Wrench, RefreshCw, ShoppingCart,
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_META = {
  oos: {
    Icon:    Package,
    iconCls: 'bg-red-100 text-red-600',
    dotCls:  'bg-red-500',
    label:   'OOS',
  },
  low_stock: {
    Icon:    AlertTriangle,
    iconCls: 'bg-amber-100 text-amber-600',
    dotCls:  'bg-amber-500',
    label:   'Low Stock',
  },
  overdue_tool: {
    Icon:    Wrench,
    iconCls: 'bg-orange-100 text-orange-600',
    dotCls:  'bg-orange-500',
    label:   'Overdue',
  },
  restock_pending: {
    Icon:    RefreshCw,
    iconCls: 'bg-blue-100 text-blue-600',
    dotCls:  'bg-blue-400',
    label:   'Restock',
  },
  po_open: {
    Icon:    ShoppingCart,
    iconCls: 'bg-indigo-100 text-indigo-600',
    dotCls:  'bg-indigo-400',
    label:   'PO',
  },
};

const SEVERITY_BORDER = {
  critical: 'border-l-red-400',
  warning:  'border-l-amber-400',
  info:     'border-l-indigo-300',
};

// ── Relative time ─────────────────────────────────────────────────────────────
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Single notification row ───────────────────────────────────────────────────
function NotifRow({ notif, onRead, onNavigate }) {
  const meta = TYPE_META[notif.type] ?? { Icon: Info, iconCls: 'bg-slate-100 text-slate-500', dotCls: 'bg-slate-400' };
  const { Icon } = meta;

  function handleClick() {
    if (!notif.read) onRead(notif.id);
    if (notif.link)  onNavigate(notif.link);
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 border-l-2 cursor-pointer
                  transition-colors hover:bg-slate-50 group
                  ${SEVERITY_BORDER[notif.severity] ?? 'border-l-slate-200'}
                  ${notif.read ? 'opacity-60' : 'bg-white'}`}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.iconCls}`}>
        <Icon size={15} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-xs font-bold uppercase tracking-wide ${notif.read ? 'text-slate-400' : 'text-slate-700'}`}>
            {notif.title}
          </p>
          {!notif.read && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dotCls}`} />}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-slate-400">{relTime(notif.created_at)}</span>
          {notif.department && notif.department !== 'all' && (
            <span className="text-[10px] text-slate-400 capitalize">· {notif.department}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
        <CheckCheck size={22} className="text-emerald-500" />
      </div>
      <p className="text-sm font-semibold text-slate-700">All caught up!</p>
      <p className="text-xs text-slate-400 mt-1">No active alerts right now.</p>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',      label: 'All'     },
  { key: 'critical', label: 'Critical' },
  { key: 'warning',  label: 'Warning'  },
  { key: 'info',     label: 'Info'     },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationBell({ notifications, unread, loading, markRead, markAllRead }) {
  const [open, setOpen]   = useState(false);
  const [tab,  setTab]    = useState('all');
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleNavigate(link) {
    setOpen(false);
    navigate(link);
  }

  const filtered = notifications.filter(n =>
    tab === 'all' ? true : n.severity === tab
  );

  const critCount = notifications.filter(n => !n.read && n.severity === 'critical').length;
  const warnCount = notifications.filter(n => !n.read && n.severity === 'warning').length;

  // Bell color based on highest severity unread
  const bellColor = critCount > 0
    ? 'text-red-500 hover:text-red-600'
    : warnCount > 0
      ? 'text-amber-500 hover:text-amber-600'
      : 'text-slate-400 hover:text-slate-600';

  const badgeColor = critCount > 0 ? 'bg-red-500' : 'bg-amber-500';

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${bellColor}`}
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 transition-all ${unread > 0 ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`} />
        {unread > 0 && (
          <span className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] ${badgeColor} text-white
                           text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow`}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200
                        flex flex-col z-50 max-h-[520px]"
             style={{ animation: 'slideDown 0.15s ease-out' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Severity tabs */}
          <div className="flex gap-1 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
            {TABS.map(t => {
              const count = t.key === 'all'
                ? notifications.filter(n => !n.read).length
                : notifications.filter(n => !n.read && n.severity === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors
                    ${tab === t.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                      ${tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <Empty />
            ) : (
              filtered.map(n => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={markRead}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 rounded-b-2xl">
              <p className="text-[10px] text-slate-400 text-center">
                {notifications.length} total alert{notifications.length !== 1 ? 's' : ''} · auto-refreshes every 60s
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
