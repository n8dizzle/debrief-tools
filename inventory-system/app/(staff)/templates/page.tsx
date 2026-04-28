import Link from 'next/link';
import { listInventoryTemplates } from '@/lib/services/inventory-templates';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import SyncTemplatesButton from './SyncTemplatesButton';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SYNC_ROLES = new Set(['admin', 'warehouse_manager']);

export default async function TemplatesPage() {
  const [session, rows] = await Promise.all([
    getServerSession(authOptions),
    listInventoryTemplates(),
  ]);

  const fromST = rows.filter((r) => r.st_template_id).length;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Inventory templates"
        description={
          rows.length === 0
            ? 'Par-stock lists per warehouse · sync from ServiceTitan or create locally'
            : `${rows.length} template${rows.length === 1 ? '' : 's'}${fromST ? ` · ${fromST} from ServiceTitan` : ''}`
        }
        actions={session?.user?.role && SYNC_ROLES.has(session.user.role) ? <SyncTemplatesButton /> : null}
      />

      <Table>
        <THead>
          <tr>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th align="right">Items</Th>
            <Th align="right">Warehouses</Th>
            <Th>Source</Th>
            <Th>Last sync</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState message="No inventory templates yet. Click &quot;Sync from ServiceTitan&quot; to import them." />
              </td>
            </tr>
          )}
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-bg-card-hover transition">
              <Td>
                <Link href={`/templates/${t.id}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                  {t.name}
                </Link>
              </Td>
              <Td muted>{t.description ?? '—'}</Td>
              <Td align="right">{t.item_count}</Td>
              <Td align="right">{t.warehouse_count}</Td>
              <Td muted>{t.st_template_id ? `ST · ${t.st_template_id}` : 'Local'}</Td>
              <Td muted>{formatDateTime(t.st_last_synced)}</Td>
              <Td>
                <StatusBadge status={t.is_active ? 'active' : 'inactive'} />
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
