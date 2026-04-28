interface TruckFormFields {
  truck_number?: string | null;
  department?: string | null;
  home_warehouse_id?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
  vin?: string | null;
  status?: string | null;
}

export default function TruckForm({
  action,
  defaults,
  warehouses,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  defaults?: TruckFormFields;
  warehouses: Array<{ id: string; name: string }>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4 text-sm max-w-lg">
      <Field
        label="Truck #"
        name="truck_number"
        required
        defaultValue={defaults?.truck_number ?? ''}
        placeholder="PL-04 / HVAC-04"
      />

      <SelectField
        label="Department"
        name="department"
        required
        defaultValue={defaults?.department ?? 'plumbing'}
        options={[
          ['plumbing', 'Plumbing'],
          ['hvac', 'HVAC'],
          ['office', 'Office'],
        ]}
      />

      <SelectField
        label="Home warehouse"
        name="home_warehouse_id"
        required
        defaultValue={defaults?.home_warehouse_id ?? warehouses[0]?.id ?? ''}
        options={warehouses.map((w) => [w.id, w.name])}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Make" name="make" defaultValue={defaults?.make ?? ''} />
        <Field label="Model" name="model" defaultValue={defaults?.model ?? ''} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field
          label="Year"
          name="year"
          type="number"
          defaultValue={defaults?.year != null ? String(defaults.year) : ''}
        />
        <Field
          label="License plate"
          name="license_plate"
          defaultValue={defaults?.license_plate ?? ''}
        />
        <Field label="VIN" name="vin" defaultValue={defaults?.vin ?? ''} />
      </div>

      <SelectField
        label="Status"
        name="status"
        defaultValue={defaults?.status ?? 'active'}
        options={[
          ['active', 'Active'],
          ['inactive', 'Inactive'],
          ['out_of_service', 'Out of service'],
        ]}
      />

      <div className="pt-2">
        <button
          type="submit"
          className="bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded px-4 py-2 transition"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">
        {label}{required && <span className="text-red-300"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
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
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">
        {label}{required && <span className="text-red-300"> *</span>}
      </span>
      <select
        name={name}
        required={required}
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
