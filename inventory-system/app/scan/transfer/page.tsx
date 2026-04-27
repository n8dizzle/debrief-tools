import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listTrucks } from '@/lib/services/trucks';
import { listWarehouses } from '@/lib/services/warehouses';
import { query } from '@/lib/db';
import TransferForm from './TransferForm';

export const dynamic = 'force-dynamic';

export default async function TransferScanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const [trucks, warehouses, ownTruck] = await Promise.all([
    listTrucks({}),
    listWarehouses(),
    query<{ id: string; truck_number: string }>(
      `SELECT t.id, t.truck_number FROM users u JOIN trucks t ON t.id = u.assigned_truck_id WHERE u.id = $1`,
      [session.user.id],
    ).then((r) => r.rows[0] ?? null),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-christmas-cream">Transfer stock</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Move material between a warehouse and a truck.
        </p>
      </header>
      <TransferForm
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        trucks={trucks.map((t) => ({ id: t.id, label: `${t.truck_number} · ${t.warehouse_name}` }))}
        ownTruckId={ownTruck?.id ?? null}
      />
    </div>
  );
}
