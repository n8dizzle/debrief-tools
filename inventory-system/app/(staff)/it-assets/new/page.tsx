import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader, Card } from '@/components/ui';
import { createItAssetAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewItAssetPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/it-assets');
  }

  const { rows: users } = await query<{ id: string; first_name: string; last_name: string }>(
    `SELECT id, first_name, last_name FROM users WHERE is_active = TRUE ORDER BY last_name, first_name`,
  );

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New IT asset"
        description="Add a device to inventory"
        back={{ href: '/it-assets', label: 'Back to IT assets' }}
      />
      <Card>
        <form action={createItAssetAction} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Type *</span>
                <select
                  name="asset_type"
                  required
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">Select type…</option>
                  <option value="laptop">Laptop</option>
                  <option value="tablet">Tablet</option>
                  <option value="phone">Phone</option>
                  <option value="monitor">Monitor</option>
                  <option value="printer">Printer</option>
                  <option value="router">Router</option>
                  <option value="ipad">iPad</option>
                  <option value="iphone">iPhone</option>
                  <option value="android_phone">Android phone</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Asset tag</span>
                <input
                  name="asset_tag"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. CA-0042"
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
                  placeholder="e.g. Apple"
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
                  placeholder="e.g. iPad 10th Gen"
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
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Status</span>
                <select
                  name="status"
                  defaultValue="available"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="available">Available</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_repair">In repair</option>
                  <option value="retired">Retired</option>
                  <option value="lost">Lost</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Department</span>
                <select
                  name="department"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                >
                  <option value="">All</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">IMEI</span>
                <input
                  name="imei"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">UDID</span>
                <input
                  name="udid"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Carrier</span>
                <input
                  name="carrier"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. AT&T"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Phone number</span>
                <input
                  name="phone_number"
                  type="tel"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
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
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Vendor / purchased from</span>
                <input
                  name="vendor"
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                  placeholder="e.g. Best Buy"
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

            <div className="col-span-2 flex items-center gap-2">
              <input
                name="mdm_enrolled"
                id="mdm_enrolled"
                type="checkbox"
                className="accent-christmas-green"
              />
              <label htmlFor="mdm_enrolled" className="text-sm text-text-secondary cursor-pointer">
                Enrolled in MDM
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
              Create IT asset
            </button>
            <a href="/it-assets" className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
