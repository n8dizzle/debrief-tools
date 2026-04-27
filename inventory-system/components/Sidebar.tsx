import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Wrench,
  HardHat,
  Truck,
  Warehouse,
  ClipboardList,
  Receipt,
  Cpu,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import type { User } from '@/types';
import { logoutAction } from '@/app/(staff)/actions';

const NAV: Array<{ href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/materials', label: 'Materials', Icon: Package },
  { href: '/tools', label: 'Tools', Icon: Wrench },
  { href: '/equipment', label: 'Equipment', Icon: HardHat },
  { href: '/trucks', label: 'Trucks', Icon: Truck },
  { href: '/warehouses', label: 'Warehouses', Icon: Warehouse },
  { href: '/restock-batches', label: 'Restock', Icon: ClipboardList },
  { href: '/purchase-orders', label: 'POs', Icon: Receipt },
  { href: '/it-assets', label: 'IT Assets', Icon: Cpu },
  { href: '/users', label: 'Users', Icon: Users },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar({ user }: { user: User }) {
  return (
    <aside className="w-60 shrink-0 border-r border-border-subtle bg-bg-secondary flex flex-col">
      <div className="px-5 py-5 border-b border-border-subtle">
        <h1 className="text-lg font-semibold text-christmas-cream">Inventory</h1>
        <p className="text-xs text-text-muted mt-0.5">Christmas Air</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition"
          >
            <Icon size={16} className="text-text-muted" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-border-subtle p-3 space-y-2">
        <div className="text-xs px-2">
          <div className="text-text-primary truncate">
            {user.first_name} {user.last_name}
          </div>
          <div className="text-text-muted truncate">{user.email}</div>
          <div className="text-christmas-green-light mt-1 capitalize">{user.role.replace('_', ' ')}</div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
