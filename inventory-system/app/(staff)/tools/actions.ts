'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTool, updateTool, type ToolInput } from '@/lib/services/tools';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readToolForm(formData: FormData): ToolInput {
  const costRaw = formData.get('purchase_cost');
  return {
    name: ((formData.get('name') as string) || '').trim() || undefined,
    manufacturer: ((formData.get('manufacturer') as string) || '').trim() || undefined,
    model: ((formData.get('model') as string) || '').trim() || undefined,
    serial_number: ((formData.get('serial_number') as string) || '').trim() || undefined,
    barcode: ((formData.get('barcode') as string) || '').trim() || undefined,
    department: ((formData.get('department') as string) || '').trim() || undefined,
    home_warehouse_id: ((formData.get('home_warehouse_id') as string) || '').trim() || undefined,
    category: ((formData.get('category') as string) || '').trim() || null,
    purchase_date: ((formData.get('purchase_date') as string) || '').trim() || null,
    purchase_cost: costRaw ? Number(costRaw) || null : null,
    warranty_expiry: ((formData.get('warranty_expiry') as string) || '').trim() || null,
    current_condition: ((formData.get('current_condition') as string) || '').trim() || null,
    status: ((formData.get('status') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };
}

export async function createToolAction(formData: FormData) {
  await requireRole();
  const tool = await createTool(readToolForm(formData));
  revalidatePath('/tools');
  redirect(`/tools/${(tool as Record<string, unknown>).id as string}`);
}

export async function updateToolAction(toolId: string, formData: FormData) {
  await requireRole();
  await updateTool(toolId, readToolForm(formData));
  revalidatePath('/tools');
  revalidatePath(`/tools/${toolId}`);
  redirect(`/tools/${toolId}`);
}
