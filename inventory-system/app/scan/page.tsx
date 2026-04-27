import Link from 'next/link';
import { Hammer, Package, ArrowLeftRight, Boxes, Truck } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

type Tile = {
  href: string;
  label: string;
  description: string;
  Icon: typeof Hammer;
};

const TILES: Tile[] = [
  { href: '/scan/consume', label: 'Consume material', description: 'Scan a part used on a job', Icon: Package },
  { href: '/scan/tool', label: 'Tool check out / in', description: 'Scan a tool barcode', Icon: Hammer },
  { href: '/scan/bin', label: 'Replenish bin', description: 'Scan a bin to load to your truck', Icon: Boxes },
  { href: '/scan/transfer', label: 'Transfer stock', description: 'Move material between truck and warehouse', Icon: ArrowLeftRight },
];

export default async function ScanHomePage() {
  const session = await getServerSession(authOptions);

  // Look up the current user's truck (for techs)
  let truckLabel: string | null = null;
  if (session?.user?.id) {
    const { rows } = await query<{ truck_number: string }>(
      `SELECT t.truck_number
         FROM users u
         JOIN trucks t ON t.id = u.assigned_truck_id
        WHERE u.id = $1`,
      [session.user.id],
    );
    truckLabel = rows[0]?.truck_number ?? null;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-christmas-cream">
          Hi, {session?.user.firstName || session?.user.name || 'there'}
        </h1>
        <p className="text-sm text-text-secondary mt-1 flex items-center gap-2">
          {truckLabel ? (
            <>
              <Truck size={14} /> Assigned to truck <strong className="text-text-primary">{truckLabel}</strong>
            </>
          ) : (
            <span className="text-text-muted">No truck assigned</span>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {TILES.map(({ href, label, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 bg-bg-card hover:bg-bg-card-hover border border-border-subtle rounded-lg p-5 transition active:bg-bg-secondary"
          >
            <div className="shrink-0 rounded-md bg-christmas-green/15 text-christmas-green-light p-2">
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-medium text-text-primary">{label}</div>
              <div className="text-xs text-text-secondary mt-0.5">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
