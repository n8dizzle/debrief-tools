import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getEquipment } from '@/lib/services/equipment';
import { listWarehouses } from '@/lib/services/warehouses';
import { PageHeader, Card } from '@/components/ui';
import { updateEquipmentAction } from '../../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/equipment');
  }

  const { id } = await params;
  let equipment;
  try {
    equipment = await getEquipment(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }
  const warehouses = await listWarehouses();

  async function action(formData: FormData) {
    'use server';
    await updateEquipmentAction(id, formData);
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Edit ${equipment.name}`}
        description="Update equipment details"
        back={{ href: `/equipment/${id}`, label: 'Back to equipment' }}
      />
      <Card>
        <form action={action} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Name *</span>
                <input
                  name="name"
                  required
                  defaultValue={equipment.name}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Manufacturer</span>
                <input
                  name="manufacturer"
                  defaultValue={equipment.manufacturer ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Model</span>
                <input
                  name="model"
                  defaultValue={equipment.model ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Serial number</span>
                <input
                  name="serial_number"
                  defaultValue={equipment.serial_number ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Department</span>
                <select
                  name="department"
                  defaultValue={(equipment as Record<string, unknown>).department as string ?? ''}
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
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Status</span>
                <select
                  name="status"
                  defaultValue={equipment.status ?? 'in_stock'}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="in_stock">In stock</option>
                  <option value="installed">Installed</option>
                  <option value="in_service">In service</option>
                  <option value="out_for_service">Out for service</option>
                  <option value="retired">Retired</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Warehouse</span>
                <select
                  name="warehouse_id"
                  defaultValue={equipment.warehouse_id ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">None</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Warranty start</span>
                <input
                  name="warranty_start"
                  type="date"
                  defaultValue={equipment.warranty_start ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Warranty expiry</span>
                <input
                  name="warranty_expiry"
                  type="date"
                  defaultValue={equipment.warranty_expiry ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Location notes</span>
                <input
                  name="location_notes"
                  defaultValue={(equipment as Record<string, unknown>).location_notes as string ?? ''}
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
                  defaultValue={(equipment as Record<string, unknown>).notes as string ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green resize-none"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
            >
              Save changes
            </button>
            <a href={`/equipment/${id}`} className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
