'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncTechnicians } from '@/lib/services/st';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

export async function syncTechniciansAction(): Promise<{ ok: true; synced: number; failed: number } | { ok: false; reason: string }> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');

  if (!process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
    return { ok: false, reason: 'ServiceTitan credentials are not configured.' };
  }
  const result = await syncTechnicians();
  revalidatePath('/users');
  return { ok: true, synced: result.synced, failed: result.failed };
}
