import Link from 'next/link';
import { listTools } from '@/lib/services/tools';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; department?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listTools({
    status: sp.status || null,
    department: sp.department || null,
  });

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Tools"
        description={`${rows.length} tool${rows.length === 1 ? '' : 's'}`}
        actions={
          <Link
            href="/tools/new"
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition flex items-center gap-2"
          >
            + New tool
          </Link>
        }
      />

      <form className="flex gap-3 mb-5" action="/tools">
        <select
          name="department"
          defaultValue={sp.department ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All departments</option>
          <option value="plumbing">Plumbing</option>
          <option value="hvac">HVAC</option>
          <option value="office">Office</option>
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any status</option>
          <option value="available">Available</option>
          <option value="checked_out">Checked out</option>
          <option value="out_for_service">Out for service</option>
          <option value="retired">Retired</option>
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
            <Th>Name</Th>
            <Th>SKU / Serial</Th>
            <Th>Category</Th>
            <Th>Dept</Th>
            <Th>Home</Th>
            <Th>Status</Th>
            <Th>Checked out to</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState message="No tools match the filter." />
              </td>
            </tr>
          )}
          {rows.map((t) => {
            const r = t as Record<string, unknown>;
            return (
              <tr key={r.id as string} className="hover:bg-bg-card-hover transition">
                <Td>
                  <Link href={`/tools/${r.id as string}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                    {r.name as string}
                  </Link>
                </Td>
                <Td mono muted>{(r.serial_number as string) ?? '—'}</Td>
                <Td muted>{(r.category as string) ?? '—'}</Td>
                <Td muted>{titleCase(r.department as string)}</Td>
                <Td muted>{(r.home_warehouse_name as string) ?? '—'}</Td>
                <Td>
                  <StatusBadge status={r.status as string} />
                </Td>
                <Td muted>
                  {(r.checked_out_to_name as string)
                    ? `${r.checked_out_to_name}${r.checked_out_truck_number ? ` · ${r.checked_out_truck_number}` : ''}`
                    : '—'}
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
