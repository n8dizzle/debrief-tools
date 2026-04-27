'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { lockBatch, approveBatch, startPicking, completeBatch } from '@/lib/services/restock-batches';

const ALLOWED = new Set(['admin', 'warehouse_manager', 'warehouse_staff']);
const APPROVE_ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole(allowed: Set<string>) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!allowed.has(s.user.role)) redirect('/dashboard');
  return s;
}

export async function lockBatchAction(batchId: string) {
  const s = await requireRole(APPROVE_ALLOWED);
  await lockBatch(batchId, s.user.id, 'manual');
  revalidatePath(`/restock-batches/${batchId}`);
  revalidatePath('/restock-batches');
}

export async function approveBatchAction(batchId: string) {
  const s = await requireRole(APPROVE_ALLOWED);
  await approveBatch(batchId, s.user.id);
  revalidatePath(`/restock-batches/${batchId}`);
  revalidatePath('/restock-batches');
}

export async function pickBatchAction(batchId: string) {
  const s = await requireRole(ALLOWED);
  await startPicking(batchId, s.user.id);
  revalidatePath(`/restock-batches/${batchId}`);
  revalidatePath('/restock-batches');
}

export async function completeBatchAction(batchId: string) {
  const s = await requireRole(ALLOWED);
  await completeBatch(batchId, s.user.id);
  revalidatePath(`/restock-batches/${batchId}`);
  revalidatePath('/restock-batches');
}
