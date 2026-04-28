import Link from 'next/link';
import { listTrucks } from '@/lib/services/trucks';
import { PageHeader, Table, THead, TBody, Td, Th, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const sp = await searchParams;
  const department = sp.department ?? '';
  const rows = await listTrucks({ department: department || null });

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Trucks"
        description={`${rows.length} truck${rows.length === 1 ? '' : 's'}${department ? ` · ${department}` : ''}`}
        actions={
          <Link
            href="/trucks/new"
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm font-medium rounded px-3 py-2 transition"
          >
            + New truck
          </Link>
        }
      />

      <form className="flex gap-3 mb-5" action="/trucks">
        <select
          name="department"
          defaultValue={department}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All departments</option>
          <option value="plumbing">Plumbing</option>
          <option value="hvac">HVAC</option>
        </select>
        <button
          type="submit"
          className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
        >
          Filter
        </button>
      </form>

      <Table>
        <THead>
          <tr>
            <Th>Truck #</Th>
            <Th>Department</Th>
            <Th>Home warehouse</Th>
            <Th>Primary tech</Th>
            <Th>Vehicle</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState message="No trucks match the filter." />
              </td>
            </tr>
          )}
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-bg-card-hover transition">
              <Td>
                <Link href={`/trucks/${t.id}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                  {t.truck_number}
                </Link>
              </Td>
              <Td>{titleCase(t.department)}</Td>
              <Td muted>{t.warehouse_name}</Td>
              <Td muted>{t.primary_tech_name ?? '—'}</Td>
              <Td muted>
                {[t.year, t.make, t.model].filter(Boolean).join(' ') || '—'}
              </Td>
              <Td>
                <StatusBadge status={t.status} />
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
