'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { checkoutAction, checkinAction, sendForServiceAction } from './actions';

export default function ToolActions({
  toolId,
  status,
  technicians,
  trucks,
}: {
  toolId: string;
  status: string;
  technicians: Array<{ id: string; name: string }>;
  trucks: Array<{ id: string; truck_number: string }>;
}) {
  const [open, setOpen] = useState<'checkout' | 'checkin' | 'service' | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(action: 'checkout' | 'checkin' | 'service', form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        if (action === 'checkout') await checkoutAction(toolId, fd);
        else if (action === 'checkin') await checkinAction(toolId, fd);
        else await sendForServiceAction(toolId, fd);
        setOpen(null);
        form.reset();
      } catch {
        /* server action errors surface in console; UI just stays open */
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'available' && (
          <button
            type="button"
            onClick={() => setOpen(open === 'checkout' ? null : 'checkout')}
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-3 py-2 transition"
          >
            Check out
          </button>
        )}
        {status === 'checked_out' && (
          <button
            type="button"
            onClick={() => setOpen(open === 'checkin' ? null : 'checkin')}
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-3 py-2 transition"
          >
            Check in
          </button>
        )}
        {(status === 'available' || status === 'checked_out') && (
          <button
            type="button"
            onClick={() => setOpen(open === 'service' ? null : 'service')}
            className="bg-bg-card-hover hover:bg-bg-secondary text-text-primary text-sm rounded px-3 py-2 transition border border-border-default"
          >
            Send for service
          </button>
        )}
      </div>

      {open === 'checkout' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit('checkout', e.currentTarget);
          }}
          className="bg-bg-card border border-border-subtle rounded-lg p-4 space-y-3 text-sm"
        >
          <FieldSelect label="Technician" name="technician_id" options={technicians.map((t) => [t.id, t.name])} />
          <FieldSelect
            label="Truck"
            name="truck_id"
            options={[['', '— none —'] as [string, string], ...trucks.map((t) => [t.id, t.truck_number] as [string, string])]}
          />
          <FieldText label="ST job id (optional)" name="st_job_id" />
          <FieldSelect
            label="Condition"
            name="condition"
            options={[['good', 'Good'], ['needs_service', 'Needs service'], ['damaged', 'Damaged']]}
          />
          <FieldText label="Notes (optional)" name="notes" />
          <Submit pending={pending} label="Check out" />
        </form>
      )}

      {open === 'checkin' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit('checkin', e.currentTarget);
          }}
          className="bg-bg-card border border-border-subtle rounded-lg p-4 space-y-3 text-sm"
        >
          <FieldSelect
            label="Condition"
            name="condition"
            options={[['good', 'Good'], ['needs_service', 'Needs service'], ['damaged', 'Damaged']]}
          />
          <FieldText label="Notes (optional)" name="notes" />
          <Submit pending={pending} label="Check in" />
        </form>
      )}

      {open === 'service' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit('service', e.currentTarget);
          }}
          className="bg-bg-card border border-border-subtle rounded-lg p-4 space-y-3 text-sm"
        >
          <FieldText label="Notes (what needs servicing)" name="notes" />
          <Submit pending={pending} label="Send for service" />
        </form>
      )}
    </div>
  );
}

function FieldText({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">{label}</span>
      <input
        name={name}
        type="text"
        className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 outline-none focus:border-christmas-green"
      />
    </label>
  );
}

function FieldSelect({ label, name, options }: { label: string; name: string; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">{label}</span>
      <select
        name={name}
        className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 outline-none focus:border-christmas-green"
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </select>
    </label>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded px-4 py-2 transition flex items-center gap-2"
    >
      {pending && <Loader2 size={14} className="animate-spin" />} {label}
    </button>
  );
}
