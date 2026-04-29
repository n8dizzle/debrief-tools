import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getTruck } from '@/lib/services/trucks';
import { listWarehouses } from '@/lib/services/warehouses';
import { listInventoryTemplates } from '@/lib/services/inventory-templates';
import { PageHeader, Card } from '@/components/ui';
import TruckForm from '@/components/TruckForm';
import { updateTruckAction } from '../../actions';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export default async function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED.has(session.user.role)) {
    redirect('/trucks');
  }

  const { id } = await params;
  let truck;
  try {
    truck = await getTruck(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const [warehouses, templates] = await Promise.all([
    listWarehouses(),
    listInventoryTemplates().catch(() => []),
  ]);

  const activeTemplates = templates
    .filter((t) => t.is_active)
    .map((t) => ({ id: t.id, name: t.name }));

  const truckAny = truck as unknown as Record<string, unknown>;

  // Bind the truck id into the action for the form
  async function action(formData: FormData) {
    'use server';
    await updateTruckAction(id, formData);
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Edit ${truck.truck_number}`}
        description="Update truck details"
        back={{ href: `/trucks/${id}`, label: 'Back to truck' }}
      />
      <Card>
        <TruckForm
          action={action}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          templates={activeTemplates}
          defaults={{
            truck_number: truck.truck_number,
            department: truck.department,
            home_warehouse_id: truck.home_warehouse_id,
            template_id: (truckAny.template_id as string | null) ?? null,
            make: truck.make,
            model: truck.model,
            year: truck.year,
            license_plate: truck.license_plate,
            vin: (truckAny.vin as string | null) ?? null,
            status: truck.status,
          }}
          submitLabel="Save changes"
        />
      </Card>
    </div>
  );
}
