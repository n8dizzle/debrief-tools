import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader, Card } from '@/components/ui';
import { createWarehouseAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewWarehousePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/warehouses');
  }

  const { rows: managers } = await query<{ id: string; first_name: string; last_name: string }>(
    `SELECT id, first_name, last_name FROM users WHERE role IN ('admin','warehouse_manager') AND is_active = TRUE ORDER BY last_name, first_name`,
  );

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New warehouse"
        description="Add a storage location"
        back={{ href: '/warehouses', label: 'Back to warehouses' }}
      />
      <Card>
        <form action={createWarehouseAction} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Name *</span>
                <input
                  name="name"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Lewisville Warehouse"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Code *</span>
                <input
                  name="code"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. LWS"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Department</span>
                <select
                  name="department"
                  defaultValue="all"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="all">All</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                </select>
              </label>
            </div>

            <div className="col-span-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Address</span>
                <input
                  name="address"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="Street address"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">City</span>
                <input
                  name="city"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="Lewisville"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">State</span>
                <input
                  name="state"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="TX"
                  maxLength={2}
                />
              </label>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">ZIP</span>
                <input
                  name="zip"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="75067"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Phone</span>
                <input
                  name="phone"
                  type="tel"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="(972) 555-0100"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Manager</span>
                <select
                  name="manager_id"
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
              Create warehouse
            </button>
            <a href="/warehouses" className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
