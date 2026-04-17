import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Wrench, Settings, Laptop,
  Warehouse, Truck, RefreshCw, ShoppingCart, BarChart3,
  ChevronRight, LogOut, Package2, Zap, Users, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { to: '/',                icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/materials',       icon: Package,         label: 'Materials' },
      { to: '/tools',           icon: Wrench,          label: 'Tools' },
      { to: '/equipment',       icon: Settings,        label: 'Equipment' },
      { to: '/it-assets',       icon: Laptop,          label: 'IT Assets' },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { to: '/warehouses',      icon: Warehouse,       label: 'Warehouses' },
      { to: '/trucks',          icon: Truck,           label: 'Trucks' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/restock-queue',   icon: RefreshCw,       label: 'Restock Queue' },
      { to: '/purchase-orders', icon: ShoppingCart,    label: 'Purchase Orders' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports',         icon: BarChart3,       label: 'Reports' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users',    icon: Users,              label: 'Users'    },
      { to: '/settings', icon: SlidersHorizontal,  label: 'Settings' },
    ],
  },
];

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user
    ? (user.name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim())
        .split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??'
    : '??';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      className={`
        flex flex-col h-full bg-slate-900 border-r border-slate-800
        transition-all duration-200
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg shrink-0">
          <Package2 className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate leading-none">Inventory</p>
            <p className="text-xs text-slate-400 mt-0.5">Mgmt System</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-2 py-3 space-y-0.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.label && !collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              collapsed ? (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center justify-center w-10 h-10 mx-auto rounded-lg mb-0.5 transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                </NavLink>
              ) : (
                <NavItem key={item.to} {...item} />
              )
            ))}
          </div>
        ))}
      </nav>

      {/* ST sync badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs text-slate-400 truncate">ServiceTitan sync</span>
            <ChevronRight className="w-3 h-3 text-slate-600 ml-auto shrink-0" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 pl-5">Every 4 hours</p>
        </div>
      )}

      {/* User footer */}
      <div className="border-t border-slate-800 px-2 py-3 shrink-0">
        <div
          className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer
                      hover:bg-slate-800 transition-colors group ${collapsed ? 'justify-center' : ''}`}
          onClick={handleLogout}
          title="Sign out"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {user ? ((user.name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()) || 'Unknown') : 'Unknown'}
                </p>
                <p className="text-[10px] text-slate-400 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <LogOut className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
