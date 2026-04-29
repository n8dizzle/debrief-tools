import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { listSupplyHouses } from '@/lib/services/supply-houses';
import { listWarehouses } from '@/lib/services/warehouses';
import { listMaterials } from '@/lib/services/materials';
import { PageHeader } from '@/components/ui';
import { createPOAction } from '../actions';
import POLineItems from './POLineItems';

const MANAGER_ROLES = new Set(['admin', 'warehouse_manager']);

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!MANAGER_ROLES.has(session.user.role)) redirect('/dashboard');

  const [vendors, warehouses, materials] = await Promise.all([
    listSupplyHouses({ isActive: true }),
    listWarehouses(),
    listMaterials({ isActive: true }),
  ]);

  const inputCls =
    'bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green w-full';
  const labelCls = 'block text-xs uppercase tracking-wide text-text-muted mb-1';

  const matForClient = materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku ?? null,
    unit_of_measure: m.unit_of_measure ?? null,
    unit_cost: m.unit_cost ?? null,
  }));

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New Purchase Order"
        description="Create a draft PO — add line items then send to supplier"
        back={{ href: '/purchase-orders', label: 'Back to POs' }}
      />

      <form action={createPOAction} className="max-w-4xl space-y-6">
        {/* Header fields */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-medium text-text-primary">PO header</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendor */}
            <div>
              <label className={labelCls}>
                Vendor / supply house <span className="text-red-400">*</span>
              </label>
              <select name="supply_house_id" required className={inputCls}>
                <option value="">— Select vendor —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className={labelCls}>
                Deliver to warehouse <span className="text-red-400">*</span>
              </label>
              <select name="warehouse_id" required className={inputCls}>
                <option value="">— Select warehouse —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className={labelCls}>Department</label>
              <select name="department" className={inputCls}>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="office">Office</option>
              </select>
            </div>

            {/* Expected delivery */}
            <div>
              <label className={labelCls}>Expected delivery</label>
              <input
                type="date"
                name="expected_delivery"
                className={inputCls}
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                name="notes"
                rows={2}
                className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green w-full resize-none"
                placeholder="Any special instructions or context for this order…"
              />
            </div>
          </div>
        </div>

        {/* Line items (client component) */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Line items</h2>
          <POLineItems materials={matForClient} />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm font-medium rounded px-5 py-2.5 transition"
          >
            Create PO
          </button>
          <a
            href="/purchase-orders"
            className="text-sm text-text-muted hover:text-text-primary transition px-5 py-2.5"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
