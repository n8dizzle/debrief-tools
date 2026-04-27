'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendPO, receivePO } from '@/lib/services/purchase-orders';

const SEND_ROLES = new Set(['admin', 'warehouse_manager']);
const RECEIVE_ROLES = new Set(['admin', 'warehouse_manager', 'warehouse_staff']);

async function requireRole(allowed: Set<string>) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!allowed.has(s.user.role)) redirect('/dashboard');
  return s;
}

export async function sendPOAction(poId: string) {
  const s = await requireRole(SEND_ROLES);
  await sendPO(poId, s.user.id);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/purchase-orders');
}

export async function receivePOAction(poId: string, formData: FormData) {
  const s = await requireRole(RECEIVE_ROLES);

  // Build line receipts from form fields named like `qty[<lineId>]`
  const lines: Array<{ line_id: string; quantity_received: number }> = [];
  for (const [key, raw] of formData.entries()) {
    const match = /^qty\[(.+)\]$/.exec(key);
    if (!match) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) lines.push({ line_id: match[1], quantity_received: n });
  }
  if (lines.length === 0) return;

  await receivePO(poId, lines, s.user.id, (formData.get('notes') as string) || null);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/purchase-orders');
}
