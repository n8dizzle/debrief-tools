import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { query } from '@/lib/db';
import { getWarehouse } from '@/lib/services/warehouses';
import { PageHeader, Card } from '@/components/ui';
import { updateWarehouseAction } from '../../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/warehouses');
  }

  const { id } = await params;
  let warehouse;
  try {
    warehouse = await getWarehouse(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const { rows: managers } = await query<{ id: string; first_name: string; last_name: string }>(
    `SELECT id, first_name, last_name FROM users WHERE role IN ('admin','warehouse_manager') AND is_active = TRUE ORDER BY last_name, first_name`,
  );

  const w = warehouse as unknown as Record<string, unknown>;

  async function action(formData: FormData) {
    'use server';
    await updateWarehouseAction(id, formData);
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Edit ${warehouse.name}`}
        description="Update warehouse details"
        back={{ href: `/warehouses/${id}`, label: 'Back to warehouse' }}
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
                  defaultValue={warehouse.name}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Department</span>
                <select
                  name="department"
                  defaultValue={(w.department as string) ?? 'all'}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="all">All</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Phone</span>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={(w.phone as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Address</span>
                <input
                  name="address"
                  defaultValue={(w.address as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">City</span>
                <input
                  name="city"
                  defaultValue={(w.city as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">State</span>
                <input
                  name="state"
                  defaultValue={(w.state as string) ?? ''}
                  maxLength={2}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">ZIP</span>
                <input
                  name="zip"
                  defaultValue={(w.zip as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Manager</span>
                <select
                  name="manager_id"
                  defaultValue={(w.manager_id as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">None</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
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
            <a href={`/warehouses/${id}`} className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
