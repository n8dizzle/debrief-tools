import Link from 'next/link';
import { listItAssets } from '@/lib/services/it-assets';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function ItAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ asset_type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listItAssets({
    assetType: sp.asset_type || null,
    status: sp.status || null,
  });

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="IT Assets"
        description={`${rows.length} asset${rows.length === 1 ? '' : 's'}`}
        actions={
          <Link
            href="/it-assets/new"
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition flex items-center gap-2"
          >
            + New IT asset
          </Link>
        }
      />

      <form className="flex gap-3 mb-5" action="/it-assets">
        <select
          name="asset_type"
          defaultValue={sp.asset_type ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All types</option>
          <option value="ipad">iPad</option>
          <option value="iphone">iPhone</option>
          <option value="android_phone">Android phone</option>
          <option value="laptop">Laptop</option>
          <option value="desktop">Desktop</option>
          <option value="other">Other</option>
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any status</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
          <option value="out_for_repair">Out for repair</option>
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
            <Th>Type</Th>
            <Th>Manufacturer / Model</Th>
            <Th>Serial</Th>
            <Th>Tag</Th>
            <Th>Status</Th>
            <Th>Assigned to</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState message="No IT assets match the filter." />
              </td>
            </tr>
          )}
          {rows.map((a) => {
            const r = a as Record<string, unknown>;
            return (
              <tr key={a.id} className="hover:bg-bg-card-hover transition">
                <Td muted>{titleCase(a.asset_type)}</Td>
                <Td>
                  <Link href={`/it-assets/${a.id}`} className="text-text-primary hover:text-christmas-green-light">
                    {a.manufacturer} {a.model}
                  </Link>
                </Td>
                <Td mono muted>{a.serial_number ?? '—'}</Td>
                <Td mono muted>{(r.asset_tag as string) ?? '—'}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
                <Td muted>{a.assigned_to_name ?? '—'}</Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
