import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listWarehouses } from '@/lib/services/warehouses';
import { PageHeader, Card } from '@/components/ui';
import TruckForm from '@/components/TruckForm';
import { createTruckAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewTruckPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/trucks');
  }

  const warehouses = await listWarehouses();

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="New truck"
        description="Add a vehicle to the fleet"
        back={{ href: '/trucks', label: 'Back to trucks' }}
      />
      <Card>
        <TruckForm
          action={createTruckAction}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          submitLabel="Create truck"
        />
      </Card>
    </div>
  );
}
