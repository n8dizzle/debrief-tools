'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createEquipment, updateEquipment, type EquipmentInput } from '@/lib/services/equipment';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readEquipmentForm(formData: FormData): EquipmentInput {
  return {
    name: ((formData.get('name') as string) || '').trim() || undefined,
    manufacturer: ((formData.get('manufacturer') as string) || '').trim() || null,
    model: ((formData.get('model') as string) || '').trim() || null,
    serial_number: ((formData.get('serial_number') as string) || '').trim() || null,
    status: ((formData.get('status') as string) || '').trim() || null,
    department: ((formData.get('department') as string) || '').trim() || null,
    warehouse_id: ((formData.get('warehouse_id') as string) || '').trim() || null,
    location_notes: ((formData.get('location_notes') as string) || '').trim() || null,
    warranty_start: ((formData.get('warranty_start') as string) || '').trim() || null,
    warranty_expiry: ((formData.get('warranty_expiry') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };
}

export async function createEquipmentAction(formData: FormData) {
  await requireRole();
  const equipment = await createEquipment(readEquipmentForm(formData));
  revalidatePath('/equipment');
  redirect(`/equipment/${equipment.id}`);
}

export async function updateEquipmentAction(equipmentId: string, formData: FormData) {
  await requireRole();
  await updateEquipment(equipmentId, readEquipmentForm(formData));
  revalidatePath('/equipment');
  revalidatePath(`/equipment/${equipmentId}`);
  redirect(`/equipment/${equipmentId}`);
}
