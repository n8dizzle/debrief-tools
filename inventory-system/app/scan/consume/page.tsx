import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { listJobs } from '@/lib/services/jobs';
import ConsumeForm from './ConsumeForm';

export const dynamic = 'force-dynamic';

export default async function ConsumePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  // Find the user's truck (required to consume from)
  const { rows: truckRows } = await query<{ id: string; truck_number: string }>(
    `SELECT t.id, t.truck_number
       FROM users u
       JOIN trucks t ON t.id = u.assigned_truck_id
      WHERE u.id = $1`,
    [session.user.id],
  );
  const truck = truckRows[0] ?? null;

  // Recent open jobs assigned to this truck (for the picker)
  const jobs = truck
    ? await listJobs({ truckId: truck.id, status: 'in_progress,scheduled', limit: 25 }).catch(() => [])
    : [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-christmas-cream">Consume material</h1>
        <p className="text-sm text-text-secondary mt-0.5">Scan or type a material barcode and confirm the quantity.</p>
      </header>

      {!truck ? (
        <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-4 text-sm text-red-300">
          You're not assigned to a truck. Ask an admin to assign you one before consuming materials.
        </div>
      ) : (
        <ConsumeForm
          truck={truck}
          jobs={jobs.map((j) => ({
            id: (j as unknown as { id: string }).id,
            label:
              ((j as unknown as { job_number?: string }).job_number) ||
              ((j as unknown as { customer_name?: string }).customer_name) ||
              ((j as unknown as { id: string }).id).slice(0, 8),
            status: (j as unknown as { status: string }).status,
          }))}
        />
      )}
    </div>
  );
}
