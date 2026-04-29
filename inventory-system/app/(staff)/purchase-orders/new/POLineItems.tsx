'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface Material {
  id: string;
  name: string;
  sku: string | null;
  unit_of_measure: string | null;
  unit_cost: number | string | null;
}

interface LineRow {
  id: string; // client-only key
  material_id: string;
  quantity_ordered: string;
  unit_cost: string;
  notes: string;
}

function emptyRow(): LineRow {
  return {
    id: crypto.randomUUID(),
    material_id: '',
    quantity_ordered: '1',
    unit_cost: '',
    notes: '',
  };
}

export default function POLineItems({ materials }: { materials: Material[] }) {
  const [rows, setRows] = useState<LineRow[]>([emptyRow()]);
  const [search, setSearch] = useState<Record<string, string>>({});

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, field: keyof LineRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Auto-fill unit_cost when a material is selected
        if (field === 'material_id' && value) {
          const mat = materials.find((m) => m.id === value);
          if (mat && updated.unit_cost === '') {
            updated.unit_cost = mat.unit_cost != null ? String(mat.unit_cost) : '';
          }
        }
        return updated;
      }),
    );
  }, [materials]);

  const filteredMaterials = useCallback(
    (rowId: string) => {
      const term = (search[rowId] ?? '').toLowerCase();
      if (!term) return materials;
      return materials.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          (m.sku ?? '').toLowerCase().includes(term),
      );
    },
    [materials, search],
  );

  // Serialize to JSON for the hidden field
  const serialized = JSON.stringify(
    rows
      .filter((r) => r.material_id && Number(r.quantity_ordered) > 0)
      .map((r) => ({
        material_id: r.material_id,
        quantity_ordered: Number(r.quantity_ordered),
        unit_cost: r.unit_cost !== '' ? r.unit_cost : null,
        notes: r.notes || null,
      })),
  );

  const inputCls =
    'bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green';

  return (
    <div className="space-y-3">
      <input type="hidden" name="lines_json" value={serialized} />

      <div className="space-y-3">
        {rows.map((row, idx) => {
          const selectedMat = materials.find((m) => m.id === row.material_id);
          const filtered = filteredMaterials(row.id);

          return (
            <div
              key={row.id}
              className="bg-bg-secondary border border-border-default rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
                  Line {idx + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-text-muted hover:text-red-400 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Material search + select */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs uppercase tracking-wide text-text-muted">
                    Material <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name or SKU…"
                    value={search[row.id] ?? ''}
                    onChange={(e) =>
                      setSearch((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className={inputCls + ' w-full mb-1'}
                  />
                  <select
                    value={row.material_id}
                    onChange={(e) => {
                      updateRow(row.id, 'material_id', e.target.value);
                      // Clear search when selection is made
                      setSearch((prev) => ({ ...prev, [row.id]: '' }));
                    }}
                    className={inputCls + ' w-full'}
                    required
                  >
                    <option value="">— Select material —</option>
                    {filtered.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.sku ? `[${m.sku}] ` : ''}{m.name}
                        {m.unit_of_measure ? ` (${m.unit_of_measure})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedMat && (
                    <p className="text-xs text-christmas-green">
                      Selected: {selectedMat.name}
                      {selectedMat.sku ? ` · SKU ${selectedMat.sku}` : ''}
                    </p>
                  )}
                </div>

                {/* Qty */}
                <div className="space-y-1.5">
                  <label className="block text-xs uppercase tracking-wide text-text-muted">
                    Qty ordered <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity_ordered}
                    onChange={(e) => updateRow(row.id, 'quantity_ordered', e.target.value)}
                    className={inputCls + ' w-full'}
                    required
                  />
                </div>

                {/* Unit cost */}
                <div className="space-y-1.5">
                  <label className="block text-xs uppercase tracking-wide text-text-muted">
                    Unit cost ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Auto from catalog"
                    value={row.unit_cost}
                    onChange={(e) => updateRow(row.id, 'unit_cost', e.target.value)}
                    className={inputCls + ' w-full'}
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs uppercase tracking-wide text-text-muted">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                    className={inputCls + ' w-full'}
                    placeholder="e.g. urgent, specific spec"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-sm text-christmas-green hover:text-christmas-green-light transition border border-dashed border-christmas-green hover:border-christmas-green-light rounded px-4 py-2 w-full justify-center"
      >
        <Plus size={15} />
        Add line item
      </button>
    </div>
  );
}
