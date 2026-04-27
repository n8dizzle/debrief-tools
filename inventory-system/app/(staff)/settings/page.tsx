import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadSettings } from '@/lib/services/settings';
import { PageHeader, Card } from '@/components/ui';
import { saveSettingsAction, triggerStSyncAction } from './actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/dashboard');
  }

  const settings = await loadSettings();

  return (
    <div className="px-8 py-6">
      <PageHeader title="Settings" description="System configuration · admin only" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Company">
          <form action={saveSettingsAction} className="space-y-3 text-sm">
            <input type="hidden" name="__section" value="company" />
            <Field label="Name" name="name" defaultValue={settings.company.name} />
            <Field label="Email" name="email" type="email" defaultValue={settings.company.email} />
            <Field label="Phone" name="phone" defaultValue={settings.company.phone} />
            <Field label="Address" name="address" defaultValue={settings.company.address} />
            <SubmitRow />
          </form>
        </Card>

        <Card title="ServiceTitan">
          <form action={saveSettingsAction} className="space-y-3 text-sm">
            <input type="hidden" name="__section" value="servicetitan" />
            <Field label="Tenant ID" name="tenant_id" defaultValue={settings.servicetitan.tenant_id} />
            <SelectField
              label="Sync frequency"
              name="sync_frequency"
              defaultValue={settings.servicetitan.sync_frequency}
              options={[
                ['every_4_hours', 'Every 4 hours'],
                ['every_8_hours', 'Every 8 hours'],
                ['daily', 'Daily'],
                ['manual', 'Manual only'],
              ]}
            />
            <CheckboxField label="Auto sync enabled" name="auto_sync_enabled" defaultChecked={!!settings.servicetitan.auto_sync_enabled} />
            <SubmitRow />
          </form>

          <form action={triggerStSyncAction} className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-muted mb-2">
              Run a sync now (pricebook + equipment + technicians).
            </p>
            <button
              type="submit"
              className="bg-bg-card-hover hover:bg-bg-secondary text-text-primary text-sm rounded px-4 py-2 transition border border-border-default"
            >
              Sync now
            </button>
          </form>
        </Card>

        <Card title="Notifications">
          <form action={saveSettingsAction} className="space-y-3 text-sm">
            <input type="hidden" name="__section" value="notifications" />
            <CheckboxField label="Email alerts enabled" name="email_alerts_enabled" defaultChecked={!!settings.notifications.email_alerts_enabled} />
            <Field
              label="Low stock threshold (× reorder pt)"
              name="low_stock_threshold"
              type="number"
              step="0.1"
              defaultValue={String(settings.notifications.low_stock_threshold)}
            />
            <Field label="Manager email" name="manager_email" type="email" defaultValue={settings.notifications.manager_email} />
            <SubmitRow />
          </form>
        </Card>

        <Card title="Inventory">
          <form action={saveSettingsAction} className="space-y-3 text-sm">
            <input type="hidden" name="__section" value="inventory" />
            <SelectField
              label="Default department"
              name="default_department"
              defaultValue={settings.inventory.default_department}
              options={[
                ['plumbing', 'Plumbing'],
                ['hvac', 'HVAC'],
                ['office', 'Office'],
              ]}
            />
            <Field label="Reorder lead days" name="reorder_lead_days" type="number" defaultValue={String(settings.inventory.reorder_lead_days)} />
            <CheckboxField label="Auto-lock batches" name="auto_lock_batches" defaultChecked={!!settings.inventory.auto_lock_batches} />
            <Field label="Auto-lock hour (0-23)" name="auto_lock_hour" type="number" defaultValue={String(settings.inventory.auto_lock_hour)} />
            <CheckboxField label="Weekly PO enabled" name="weekly_po_enabled" defaultChecked={!!settings.inventory.weekly_po_enabled} />
            <SelectField
              label="Weekly PO day"
              name="weekly_po_day"
              defaultValue={settings.inventory.weekly_po_day}
              options={[
                ['monday', 'Monday'],
                ['tuesday', 'Tuesday'],
                ['wednesday', 'Wednesday'],
                ['thursday', 'Thursday'],
                ['friday', 'Friday'],
              ]}
            />
            <SubmitRow />
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  step,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 outline-none focus:border-christmas-green"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 outline-none focus:border-christmas-green"
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border-default bg-bg-secondary"
      />
      <span>{label}</span>
    </label>
  );
}

function SubmitRow() {
  return (
    <div className="pt-2">
      <button
        type="submit"
        className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
      >
        Save
      </button>
    </div>
  );
}
