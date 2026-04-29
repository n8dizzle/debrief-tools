import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getItAsset } from '@/lib/services/it-assets';
import { PageHeader, Card } from '@/components/ui';
import { updateItAssetAction } from '../../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function EditItAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/it-assets');
  }

  const { id } = await params;
  let assetData;
  try {
    assetData = await getItAsset(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }
  const a = assetData.asset as Record<string, unknown>;

  async function action(formData: FormData) {
    'use server';
    await updateItAssetAction(id, formData);
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Edit ${a.manufacturer as string} ${a.model as string}`}
        description="Update IT asset details"
        back={{ href: `/it-assets/${id}`, label: 'Back to IT asset' }}
      />
      <Card>
        <form action={action} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Type</span>
                <select
                  name="asset_type"
                  defaultValue={(a.asset_type as string) ?? ''}
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
                  defaultValue={(a.asset_tag as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Manufacturer</span>
                <input
                  name="manufacturer"
                  defaultValue={(a.manufacturer as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Model</span>
                <input
                  name="model"
                  defaultValue={(a.model as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Serial number</span>
                <input
                  name="serial_number"
                  defaultValue={(a.serial_number as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Status</span>
                <select
                  name="status"
                  defaultValue={(a.status as string) ?? 'available'}
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
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">IMEI</span>
                <input
                  name="imei"
                  defaultValue={(a.imei as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">UDID</span>
                <input
                  name="udid"
                  defaultValue={(a.udid as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Carrier</span>
                <input
                  name="carrier"
                  defaultValue={(a.carrier as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Phone number</span>
                <input
                  name="phone_number"
                  type="tel"
                  defaultValue={(a.phone_number as string) ?? ''}
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
                  defaultValue={(a.warranty_expiry as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div>
              <label>
                <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Vendor / purchased from</span>
                <input
                  name="vendor"
                  defaultValue={(a.vendor as string) ?? ''}
                  className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
                />
              </label>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                name="mdm_enrolled"
                id="mdm_enrolled"
                type="checkbox"
                defaultChecked={Boolean(a.mdm_enrolled)}
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
                  defaultValue={(a.notes as string) ?? ''}
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
            <a href={`/it-assets/${id}`} className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
