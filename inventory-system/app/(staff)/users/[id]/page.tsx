import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getUser } from '@/lib/services/users';
import { PageHeader, Card, DataRow, StatusBadge } from '@/components/ui';
import { titleCase, formatDateTime } from '@/lib/format';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let u;
  try {
    u = await getUser(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`${u.first_name} ${u.last_name}`}
        description={u.email}
        back={{ href: '/users', label: 'Back to users' }}
        actions={<StatusBadge status={u.is_active ? 'active' : 'inactive'} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Identity">
          <dl className="text-sm">
            <DataRow label="Email" value={u.email} />
            <DataRow label="Phone" value={u.phone ?? '—'} />
            <DataRow label="Role" value={titleCase(u.role)} />
            <DataRow label="Department" value={titleCase(u.department ?? '—')} />
            <DataRow label="Created" value={formatDateTime(u.created_at)} />
          </dl>
        </Card>

        <Card title="Assignment">
          <dl className="text-sm">
            <DataRow label="Home warehouse" value={u.warehouse_name ?? '—'} />
            <DataRow label="Truck" value={u.truck_number ?? '—'} />
            <DataRow label="ST tech id" value={u.st_technician_id ?? '—'} />
          </dl>
        </Card>
      </section>
    </div>
  );
}
