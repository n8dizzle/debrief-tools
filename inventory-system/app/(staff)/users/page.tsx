import Link from 'next/link';
import { listUsers } from '@/lib/services/users';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; department?: string; is_active?: string }>;
}) {
  const sp = await searchParams;
  const ia = sp.is_active;
  const rows = await listUsers({
    role: sp.role || null,
    department: sp.department || null,
    isActive: ia === undefined || ia === '' ? null : ia === 'true',
    warehouseId: null,
  });

  return (
    <div className="px-8 py-6">
      <PageHeader title="Users" description={`${rows.length} user${rows.length === 1 ? '' : 's'}`} />

      <form className="flex gap-3 mb-5" action="/users">
        <select
          name="role"
          defaultValue={sp.role ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any role</option>
          <option value="admin">Admin</option>
          <option value="warehouse_manager">Warehouse manager</option>
          <option value="warehouse_staff">Warehouse staff</option>
          <option value="technician">Technician</option>
          <option value="office_staff">Office staff</option>
          <option value="it_admin">IT admin</option>
        </select>
        <select
          name="department"
          defaultValue={sp.department ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any dept</option>
          <option value="plumbing">Plumbing</option>
          <option value="hvac">HVAC</option>
          <option value="office">Office</option>
        </select>
        <select
          name="is_active"
          defaultValue={sp.is_active ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
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
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Department</Th>
            <Th>Truck</Th>
            <Th>From ST</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState message="No users match the filter." />
              </td>
            </tr>
          )}
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-bg-card-hover transition">
              <Td>
                <Link href={`/users/${u.id}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                  {u.first_name} {u.last_name}
                </Link>
              </Td>
              <Td muted>{u.email}</Td>
              <Td muted>{titleCase(u.role)}</Td>
              <Td muted>{titleCase(u.department ?? '—')}</Td>
              <Td muted>{u.truck_number ?? '—'}</Td>
              <Td muted>{u.st_technician_id ? 'Yes' : '—'}</Td>
              <Td>
                <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
