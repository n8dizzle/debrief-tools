import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import ToolScanForm from './ToolScanForm';

export const dynamic = 'force-dynamic';

export default async function ToolScanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const { rows } = await query<{ id: string; truck_number: string }>(
    `SELECT t.id, t.truck_number
       FROM users u
       JOIN trucks t ON t.id = u.assigned_truck_id
      WHERE u.id = $1`,
    [session.user.id],
  );
  const truck = rows[0] ?? null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-christmas-cream">Tool check out / in</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Scan a tool barcode. If it's available we'll check it out to you; if it's already
          checked out to you we'll check it in.
        </p>
      </header>
      <ToolScanForm
        currentTechId={session.user.id}
        truck={truck}
      />
    </div>
  );
}
