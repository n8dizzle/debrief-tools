import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getWarehouse } from '@/lib/services/warehouses';
import { getWarehouseStock } from '@/lib/services/material-movements';
import { PageHeader } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { submitCycleCountAction } from '../../actions';

const MANAGER_ROLES = new Set(['admin', 'warehouse_manager']);

export default async function CycleCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!MANAGER_ROLES.has(session.user.role)) redirect('/dashboard');

  let wh;
  try {
    wh = await getWarehouse(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const stock = await getWarehouseStock(id);

  const inputCls =
    'bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green';

  const action = submitCycleCountAction.bind(null, id);

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Cycle Count — ${wh.name}`}
        description="Enter counted quantities. Leave blank to skip an item."
        back={{ href: `/warehouses/${id}`, label: `Back to ${wh.name}` }}
      />

      <form action={action} className="max-w-4xl">
        <div className="bg-bg-card border border-border-default rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-border-default">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  SKU
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  Material
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  Location
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  Current qty
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  Counted qty
                </th>
                <th className="px-4 py-3 text-xs uppercase tracking-wide text-text-muted font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {stock.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted text-sm">
                    No stock recorded at this warehouse yet.
                  </td>
                </tr>
              )}
              {stock.map((row, i) => {
                const r = row as Record<string, unknown>;
                const materialId = r.material_id as string;
                return (
                  <tr key={`${materialId}-${i}`} className="hover:bg-bg-card-hover transition">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {(r.sku as string) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {r.name as string}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {(r.location_label as string) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                      {formatNumber(r.quantity_on_hand as number | string)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        name={`qty[${materialId}]`}
                        min="0"
                        step="1"
                        placeholder="—"
                        className={inputCls + ' w-28 text-right'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        name={`notes[${materialId}]`}
                        placeholder="Optional"
                        className={inputCls + ' w-full min-w-32'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {stock.length > 0 && (
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm font-medium rounded px-5 py-2.5 transition"
            >
              Submit count
            </button>
            <a
              href={`/warehouses/${id}`}
              className="text-sm text-text-muted hover:text-text-primary transition px-5 py-2.5"
            >
              Cancel
            </a>
          </div>
        )}
      </form>
    </div>
  );
}
