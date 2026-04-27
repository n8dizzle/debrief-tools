import Link from 'next/link';
import { listSupplyHouses } from '@/lib/services/supply-houses';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listSupplyHouses({ department: sp.department || null, isActive: null });

  return (
    <div className="px-8 py-6">
      <PageHeader title="Vendors" description={`${rows.length} supply house${rows.length === 1 ? '' : 's'}`} />

      <form className="flex gap-3 mb-5" action="/vendors">
        <select
          name="department"
          defaultValue={sp.department ?? ''}
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
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>Contact</Th>
            <Th>Email</Th>
            <Th align="right">Lead time</Th>
            <Th align="right">Open POs</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState message="No vendors yet. Add some via the API." />
              </td>
            </tr>
          )}
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-bg-card-hover transition">
              <Td>
                <Link href={`/vendors/${v.id}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                  {v.name}
                </Link>
              </Td>
              <Td muted>{titleCase(v.department ?? '—')}</Td>
              <Td muted>{v.contact_name ?? '—'}</Td>
              <Td muted>{v.contact_email}</Td>
              <Td align="right" muted>{v.lead_time_days != null ? `${v.lead_time_days}d` : '—'}</Td>
              <Td align="right">{v.open_po_count}</Td>
              <Td>
                <StatusBadge status={v.is_active ? 'active' : 'inactive'} />
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
