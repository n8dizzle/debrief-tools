import { NextResponse, type NextRequest } from 'next/server';
import { checkCronSecret } from '@/lib/cron-guard';
import { syncPricebook, syncEquipment, syncTechnicians } from '@/lib/services/st';
import { syncInventoryTemplates } from '@/lib/services/inventory-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Every 4 hours — pull pricebook, equipment, technicians, and inventory
 *  templates from ServiceTitan. Each sub-job is best-effort; one failing
 *  doesn't block the others. */
export async function GET(req: NextRequest) {
  const denied = checkCronSecret(req);
  if (denied) return denied;

  if (!process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'ServiceTitan credentials not configured',
    });
  }

  const result: Record<string, unknown> = {};
  for (const [name, fn] of [
    ['pricebook', syncPricebook],
    ['equipment', syncEquipment],
    ['technicians', syncTechnicians],
    ['inventory_templates', syncInventoryTemplates],
  ] as const) {
    const t0 = Date.now();
    try {
      result[name] = { ok: true, ms: Date.now() - t0, ...(await fn()) };
    } catch (e) {
      result[name] = { ok: false, ms: Date.now() - t0, error: (e as Error).message };
    }
  }
  return NextResponse.json({ ok: true, result });
}
