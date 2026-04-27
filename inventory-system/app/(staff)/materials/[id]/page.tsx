import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import type { Material } from '@/types';

interface MaterialDetailResponse {
  material?: Material;
  warehouse_stock?: Array<{ warehouse_id: string; warehouse_name?: string; qty_on_hand: number | string }>;
  truck_stock?: Array<{ truck_id: string; truck_number?: string; qty_on_hand: number | string }>;
}

function fmtCurrency(v: Material['unit_cost']) {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtQty(v: number | string | null | undefined) {
  if (v === null || v === undefined) return '0';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail: MaterialDetailResponse;
  try {
    detail = await api<MaterialDetailResponse>(`/materials/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const m = detail.material;
  if (!m) notFound();

  const totalOnHand =
    (detail.warehouse_stock ?? []).reduce((sum, s) => sum + (Number(s.qty_on_hand) || 0), 0) +
    (detail.truck_stock ?? []).reduce((sum, s) => sum + (Number(s.qty_on_hand) || 0), 0);

  return (
    <div className="px-8 py-6">
      <Link href="/materials" className="text-sm text-text-secondary hover:text-christmas-green-light">
        ← Back to materials
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold text-christmas-cream">{m.name}</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          <span className="font-mono">{m.sku}</span>
          {m.barcode ? ` · barcode ${m.barcode}` : ''}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Unit cost</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtCurrency(m.unit_cost)}</div>
          <div className="text-xs text-text-secondary mt-1">per {m.unit_of_measure || 'unit'}</div>
        </div>
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">On hand</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{totalOnHand.toLocaleString()}</div>
          <div className="text-xs text-text-secondary mt-1">across all locations</div>
        </div>
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Reorder point</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{m.reorder_point ?? '—'}</div>
          <div className="text-xs text-text-secondary mt-1">
            {m.reorder_quantity ? `Reorder ${m.reorder_quantity}` : 'Not set'}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <h2 className="text-sm font-medium text-text-primary mb-3">Details</h2>
          <dl className="text-sm space-y-2">
            <Row label="Department" value={<span className="capitalize">{m.department}</span>} />
            <Row label="Category" value={m.category || '—'} />
            <Row label="Status" value={m.is_active ? 'Active' : 'Inactive'} />
            <Row label="ST pricebook id" value={m.st_pricebook_id || '—'} />
          </dl>
          {m.description && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <div className="text-xs uppercase tracking-wide text-text-muted mb-1">Description</div>
              <p className="text-sm text-text-secondary whitespace-pre-line">{m.description}</p>
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <h2 className="text-sm font-medium text-text-primary mb-3">Stock by location</h2>
          {(detail.warehouse_stock?.length ?? 0) + (detail.truck_stock?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">Not currently stocked anywhere.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border-subtle">
                {detail.warehouse_stock?.map((s) => (
                  <tr key={`w-${s.warehouse_id}`}>
                    <td className="py-2 text-text-secondary">Warehouse</td>
                    <td className="py-2">{s.warehouse_name || s.warehouse_id}</td>
                    <td className="py-2 text-right tabular-nums">{fmtQty(s.qty_on_hand)}</td>
                  </tr>
                ))}
                {detail.truck_stock?.map((s) => (
                  <tr key={`t-${s.truck_id}`}>
                    <td className="py-2 text-text-secondary">Truck</td>
                    <td className="py-2">{s.truck_number || s.truck_id}</td>
                    <td className="py-2 text-right tabular-nums">{fmtQty(s.qty_on_hand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary text-right">{value}</dd>
    </div>
  );
}
