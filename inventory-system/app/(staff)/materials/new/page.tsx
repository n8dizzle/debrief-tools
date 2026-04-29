import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listSupplyHouses } from '@/lib/services/supply-houses';
import { PageHeader, Card } from '@/components/ui';
import { createMaterialAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewMaterialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/materials');
  }

  const vendors = await listSupplyHouses({ isActive: true });

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New material"
        description="Add a part to the catalog"
        back={{ href: '/materials', label: 'Back to materials' }}
      />
      <Card>
        <form action={createMaterialAction} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Name *</span>
                <input
                  name="name"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. 1/2″ Ball Valve"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">SKU</span>
                <input
                  name="sku"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. FG-BV-12"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Barcode</span>
                <input
                  name="barcode"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="Scan or type barcode"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Department *</span>
                <select
                  name="department"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">Select department…</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Category</span>
                <input
                  name="category"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Valves, Fittings…"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Unit of measure</span>
                <input
                  name="unit_of_measure"
                  defaultValue="EA"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Unit cost ($)</span>
                <input
                  name="unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="0.00"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Reorder point</span>
                <input
                  name="reorder_point"
                  type="number"
                  min="0"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="0"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Reorder quantity</span>
                <input
                  name="reorder_quantity"
                  type="number"
                  min="0"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="0"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Max stock</span>
                <input
                  name="max_stock"
                  type="number"
                  min="0"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="0"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Primary vendor</span>
                <select
                  name="primary_supply_house_id"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">None</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Secondary vendor</span>
                <select
                  name="secondary_supply_house_id"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">None</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Description</span>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green resize-none"
                  placeholder="Optional description…"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
            >
              Create material
            </button>
            <a href="/materials" className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
