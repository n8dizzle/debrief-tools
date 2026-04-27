import { api } from '@/lib/api';
import type { Material, Truck, Warehouse } from '@/types';

interface DashboardStats {
  materials_total?: number;
  materials_low_stock?: number;
  trucks_active?: number;
  warehouses_total?: number;
  open_pos?: number;
  pending_restock_batches?: number;
}

async function loadStats(): Promise<{
  stats: DashboardStats;
  materialsCount: number;
  trucksCount: number;
  warehousesCount: number;
} > {
  // Try the dedicated stats endpoint; fall back to counting list responses if it fails.
  let stats: DashboardStats = {};
  try {
    stats = await api<DashboardStats>('/admin/stats/dashboard');
  } catch {
    /* ignore — endpoint may not return for non-admins */
  }

  const [materials, trucks, warehouses] = await Promise.all([
    api<{ materials?: Material[]; total?: number }>('/materials?limit=1').catch(() => ({})),
    api<{ trucks?: Truck[]; total?: number }>('/trucks').catch(() => ({})),
    api<{ warehouses?: Warehouse[]; total?: number }>('/warehouses').catch(() => ({})),
  ]);

  return {
    stats,
    materialsCount: materials.total ?? materials.materials?.length ?? 0,
    trucksCount: trucks.total ?? trucks.trucks?.length ?? 0,
    warehousesCount: warehouses.total ?? warehouses.warehouses?.length ?? 0,
  };
}

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-christmas-cream tabular-nums">{value}</div>
      {sublabel && <div className="text-xs text-text-secondary mt-1">{sublabel}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const { stats, materialsCount, trucksCount, warehousesCount } = await loadStats();

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-christmas-cream">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Live inventory across warehouses and field trucks.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Materials"
          value={stats.materials_total ?? materialsCount}
          sublabel={stats.materials_low_stock ? `${stats.materials_low_stock} low` : 'In catalog'}
        />
        <StatCard label="Active trucks" value={stats.trucks_active ?? trucksCount} sublabel="Field fleet" />
        <StatCard label="Warehouses" value={stats.warehouses_total ?? warehousesCount} sublabel="Lewisville &amp; Argyle" />
        <StatCard
          label="Open POs"
          value={stats.open_pos ?? 0}
          sublabel={stats.pending_restock_batches ? `${stats.pending_restock_batches} restock batches` : undefined}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <h2 className="text-sm font-medium text-text-primary">Quick links</h2>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>
              <a className="hover:text-christmas-green-light" href="/materials">
                Browse materials catalog &rarr;
              </a>
            </li>
            <li>
              <a className="hover:text-christmas-green-light" href="/trucks">
                Field trucks &rarr;
              </a>
            </li>
            <li>
              <a className="hover:text-christmas-green-light" href="/warehouses">
                Warehouses &rarr;
              </a>
            </li>
          </ul>
        </div>
        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <h2 className="text-sm font-medium text-text-primary">ServiceTitan</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Pricebook, technicians, and installed-equipment syncs run every 4 hours. Trucks are
            managed manually (ST does not expose a fleet endpoint).
          </p>
        </div>
      </section>
    </div>
  );
}
