import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { format } from 'date-fns';
import NotificationBell from './NotificationBell.jsx';
import { useNotifications } from '../hooks/useNotifications.js';

export default function Header({ title, subtitle, collapsed, onToggleSidebar, actions }) {
  const { notifications, unread, loading, markRead, markAllRead } = useNotifications();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-6 shrink-0 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
        aria-label="Toggle sidebar"
      >
        {collapsed
          ? <PanelLeftOpen  className="w-5 h-5" />
          : <PanelLeftClose className="w-5 h-5" />
        }
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-slate-800 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
      </div>

      {/* Date */}
      <span className="hidden md:block text-xs text-slate-400 whitespace-nowrap">
        {format(new Date(), 'EEEE, MMM d yyyy')}
      </span>

      {/* Actions slot */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Notification bell */}
      <NotificationBell
        notifications={notifications}
        unread={unread}
        loading={loading}
        markRead={markRead}
        markAllRead={markAllRead}
      />
    </header>
  );
}
