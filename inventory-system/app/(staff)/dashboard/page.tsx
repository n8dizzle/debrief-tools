import { listMaterials } from '@/lib/services/materials';
import { listTrucks } from '@/lib/services/trucks';
import { listWarehouses } from '@/lib/services/warehouses';
import { getDashboardStats, type DashboardStats } from '@/lib/services/admin-stats';

async function loadDashboard() {
  const [materials, trucks, warehouses, stats] = await Promise.all([
    listMaterials({}),
    listTrucks({}),
    listWarehouses(),
    getDashboardStats().catch<null>(() => null),
  ]);

  return {
    materialsCount: materials.length,
    trucksCount: trucks.length,
    warehousesCount: warehouses.length,
    stats,
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

function sumCount(rows: Array<{ count: string }> | undefined) {
  return rows?.reduce((s, r) => s + parseInt(r.count, 10), 0) ?? 0;
}

export default async function DashboardPage() {
  const { materialsCount, trucksCount, warehousesCount, stats } = await loadDashboard();
  const openPOs = sumCount(stats?.purchase_orders);
  const openRestocks = sumCount(stats?.restock_batches);

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
          value={materialsCount.toLocaleString()}
          sublabel={
            stats && stats.materials_below_reorder > 0
              ? `${stats.materials_below_reorder} below reorder`
              : 'In catalog'
          }
        />
        <StatCard label="Active trucks" value={trucksCount} sublabel="Field fleet" />
        <StatCard
          label="Warehouses"
          value={warehousesCount}
          sublabel="Lewisville &amp; Argyle"
        />
        <StatCard
          label="Open POs"
          value={openPOs}
          sublabel={openRestocks > 0 ? `${openRestocks} open restock batches` : undefined}
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
          <h2 className="text-sm font-medium text-text-primary">Recent ServiceTitan syncs</h2>
          {stats?.last_st_syncs?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.last_st_syncs.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-4">
                  <span className="text-text-secondary capitalize">{s.sync_type}</span>
                  <span className="text-text-muted tabular-nums">
                    {s.records_synced.toLocaleString()} records · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">No syncs recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
