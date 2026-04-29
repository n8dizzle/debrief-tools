import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listWarehouses } from '@/lib/services/warehouses';
import { listInventoryTemplates } from '@/lib/services/inventory-templates';
import { PageHeader, Card } from '@/components/ui';
import TruckForm from '@/components/TruckForm';
import { createTruckAction } from '../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function NewTruckPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/trucks');
  }

  const [warehouses, templates] = await Promise.all([
    listWarehouses(),
    listInventoryTemplates().catch(() => []),
  ]);

  const activeTemplates = templates
    .filter((t) => t.is_active)
    .map((t) => ({ id: t.id, name: t.name }));

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
          templates={activeTemplates}
          submitLabel="Create truck"
        />
      </Card>
    </div>
  );
}
