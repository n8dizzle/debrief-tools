import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listWarehouses } from '@/lib/services/warehouses';
import { PageHeader, Card } from '@/components/ui';
import { createToolAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewToolPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/tools');
  }

  const warehouses = await listWarehouses();

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New tool"
        description="Add a tool to inventory"
        back={{ href: '/tools', label: 'Back to tools' }}
      />
      <Card>
        <form action={createToolAction} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Name *</span>
                <input
                  name="name"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Milwaukee M18 Drill"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Manufacturer *</span>
                <input
                  name="manufacturer"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Milwaukee"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Model *</span>
                <input
                  name="model"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. M18B"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Serial number *</span>
                <input
                  name="serial_number"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Barcode *</span>
                <input
                  name="barcode"
                  required
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
                  <option value="">Select…</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Home warehouse *</span>
                <select
                  name="home_warehouse_id"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">Select…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Category</span>
                <input
                  name="category"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Power tools"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Condition</span>
                <select
                  name="current_condition"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">Select…</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Purchase date</span>
                <input
                  name="purchase_date"
                  type="date"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Purchase cost ($)</span>
                <input
                  name="purchase_cost"
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
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Warranty expiry</span>
                <input
                  name="warranty_expiry"
                  type="date"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Notes</span>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green resize-none"
                  placeholder="Optional notes…"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
            >
              Create tool
            </button>
            <a href="/tools" className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
