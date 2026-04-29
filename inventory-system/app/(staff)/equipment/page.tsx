import Link from 'next/link';
import { listEquipment } from '@/lib/services/equipment';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 100;

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const rows = await listEquipment({
    status: sp.status || null,
    search: sp.search || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Equipment"
        description={`${rows.length} item${rows.length === 1 ? '' : 's'} on this page`}
        actions={
          <Link
            href="/equipment/new"
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition flex items-center gap-2"
          >
            + New equipment
          </Link>
        }
      />

      <form className="flex gap-3 mb-5" action="/equipment">
        <input
          type="text"
          name="search"
          defaultValue={sp.search ?? ''}
          placeholder="Search by name, model, or serial..."
          className="flex-1 bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any status</option>
          <option value="installed">Installed</option>
          <option value="in_stock">In stock</option>
          <option value="retired">Retired</option>
        </select>
        <button
          type="submit"
          className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
        >
          Search
        </button>
      </form>

      <Table>
        <THead>
          <tr>
            <Th>Name</Th>
            <Th>Manufacturer</Th>
            <Th>Model</Th>
            <Th>Serial</Th>
            <Th>Status</Th>
            <Th>Installed</Th>
            <Th>Warranty</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState message="No equipment matches the filters." />
              </td>
            </tr>
          )}
          {rows.map((e) => (
            <tr key={e.id} className="hover:bg-bg-card-hover transition">
              <Td>
                <Link href={`/equipment/${e.id}`} className="text-text-primary hover:text-christmas-green-light">
                  {e.name}
                </Link>
              </Td>
              <Td muted>{e.manufacturer ?? '—'}</Td>
              <Td muted>{e.model ?? '—'}</Td>
              <Td mono muted>{e.serial_number ?? '—'}</Td>
              <Td>
                <StatusBadge status={e.status} />
              </Td>
              <Td muted>{formatDate(e.installed_at)}</Td>
              <Td muted>{formatDate(e.warranty_expiry)}</Td>
            </tr>
          ))}
        </TBody>
      </Table>

      <nav className="flex items-center justify-between mt-4 text-sm text-text-secondary">
        <span>Page {page}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/equipment?${new URLSearchParams({ ...(sp.search && { search: sp.search }), ...(sp.status && { status: sp.status }), page: String(page - 1) }).toString()}`}
              className="px-3 py-1.5 rounded border border-border-default hover:bg-bg-card-hover"
            >
              ← Previous
            </Link>
          )}
          {rows.length === PAGE_SIZE && (
            <Link
              href={`/equipment?${new URLSearchParams({ ...(sp.search && { search: sp.search }), ...(sp.status && { status: sp.status }), page: String(page + 1) }).toString()}`}
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
