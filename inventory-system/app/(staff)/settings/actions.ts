'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { patchSettings } from '@/lib/services/settings';
import { syncPricebook, syncEquipment, syncTechnicians, syncInventoryTransfers } from '@/lib/services/st';
import { syncInventoryTemplates } from '@/lib/services/inventory-templates';
import { redirect } from 'next/navigation';

const ALLOWED_ROLES = new Set(['admin', 'warehouse_manager']);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !ALLOWED_ROLES.has(session.user.role)) {
    redirect('/dashboard');
  }
}

const COERCE: Record<string, (v: FormDataEntryValue) => unknown> = {
  // booleans
  auto_sync_enabled: (v) => v === 'on',
  email_alerts_enabled: (v) => v === 'on',
  auto_lock_batches: (v) => v === 'on',
  weekly_po_enabled: (v) => v === 'on',
  // numbers
  low_stock_threshold: (v) => Number(v),
  reorder_lead_days: (v) => Number(v),
  auto_lock_hour: (v) => Number(v),
};

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const section = String(formData.get('__section') ?? '');
  if (!section) return;

  const data: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith('__')) continue;
    const coerce = COERCE[key];
    data[key] = coerce ? coerce(raw) : String(raw);
  }
  // Force-set checkbox booleans that weren't checked (FormData omits them)
  for (const k of Object.keys(COERCE)) {
    if (COERCE[k].length && !(k in data) && k.endsWith('enabled')) data[k] = false;
    if (COERCE[k].length && !(k in data) && k === 'auto_lock_batches') data[k] = false;
  }

  await patchSettings(section, data);
  revalidatePath('/settings');
}

export async function triggerStSyncAction() {
  await requireAdmin();
  if (!process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
    revalidatePath('/settings');
    return;
  }
  await Promise.all([
    syncPricebook().catch((e: Error) => console.error('[settings] pricebook sync:', e.message)),
    syncEquipment().catch((e: Error) => console.error('[settings] equipment sync:', e.message)),
    syncTechnicians().catch((e: Error) => console.error('[settings] technicians sync:', e.message)),
    syncInventoryTemplates().catch((e: Error) => console.error('[settings] templates sync:', e.message)),
    syncInventoryTransfers().catch((e: Error) => console.error('[settings] transfers sync:', e.message)),
  ]);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
}
