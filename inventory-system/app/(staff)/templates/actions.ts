'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncInventoryTemplates } from '@/lib/services/inventory-templates';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

type SyncResult =
  | { ok: true; skipped?: boolean; reason?: string; synced: number; failed: number }
  | { ok: false; reason: string };

export async function syncTemplatesAction(): Promise<SyncResult> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');

  try {
    const r = await syncInventoryTemplates();
    revalidatePath('/templates');
    if (r.skipped) return { ok: true, skipped: true, reason: r.reason, synced: 0, failed: 0 };
    return { ok: true, synced: r.synced, failed: r.failed };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
