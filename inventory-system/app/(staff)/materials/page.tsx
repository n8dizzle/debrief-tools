import Link from 'next/link';
import { api } from '@/lib/api';
import type { Material } from '@/types';

interface MaterialsResponse {
  materials?: Material[];
  total?: number;
  page?: number;
}

const PAGE_SIZE = 50;

function formatMoney(v: Material['unit_cost']): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || '';
  const department = sp.department || '';
  const page = Math.max(1, Number(sp.page) || 1);

  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (department) params.set('department', department);
  params.set('limit', String(PAGE_SIZE));
  params.set('page', String(page));

  let data: MaterialsResponse = {};
  let error: string | null = null;
  try {
    data = await api<MaterialsResponse>(`/materials?${params.toString()}`);
  } catch (e) {
    error = (e as Error).message;
  }
  const items = data.materials ?? [];
  const total = data.total ?? items.length;
  const hasMore = items.length === PAGE_SIZE;

  return (
    <div className="px-8 py-6">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-christmas-cream">Materials</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {total.toLocaleString()} item{total === 1 ? '' : 's'} in the catalog
            {q ? ` matching "${q}"` : ''}
            {department ? ` · ${department}` : ''}
          </p>
        </div>
      </header>

      <form className="flex gap-3 mb-5" action="/materials">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by SKU, name, or barcode..."
          className="flex-1 bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        />
        <select
          name="department"
          defaultValue={department}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All departments</option>
          <option value="plumbing">Plumbing</option>
          <option value="hvac">HVAC</option>
          <option value="office">Office</option>
        </select>
        <button
          type="submit"
          className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">SKU</th>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Dept</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-right px-4 py-2.5 font-medium">Unit cost</th>
              <th className="text-left px-4 py-2.5 font-medium">UoM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No materials match your filters.
                </td>
              </tr>
            )}
            {items.map((m) => (
              <tr key={m.id} className="hover:bg-bg-card-hover transition">
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{m.sku}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/materials/${m.id}`} className="text-text-primary hover:text-christmas-green-light">
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 capitalize text-text-secondary">{m.department}</td>
                <td className="px-4 py-2.5 text-text-secondary">{m.category || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(m.unit_cost)}</td>
                <td className="px-4 py-2.5 text-text-secondary">{m.unit_of_measure || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center justify-between mt-4 text-sm text-text-secondary">
        <span>
          Page {page} · showing up to {PAGE_SIZE} per page
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/materials?${new URLSearchParams({ ...(q && { q }), ...(department && { department }), page: String(page - 1) }).toString()}`}
              className="px-3 py-1.5 rounded border border-border-default hover:bg-bg-card-hover"
            >
              ← Previous
            </Link>
          )}
          {hasMore && (
            <Link
              href={`/materials?${new URLSearchParams({ ...(q && { q }), ...(department && { department }), page: String(page + 1) }).toString()}`}
              className="px-3 py-1.5 rounded border border-border-default hover:bg-bg-card-hover"
            >
              Next →
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
