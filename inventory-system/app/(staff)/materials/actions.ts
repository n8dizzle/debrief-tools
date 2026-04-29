'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createMaterial, updateMaterial, type MaterialInput } from '@/lib/services/materials';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readMaterialForm(formData: FormData): MaterialInput {
  const unitCostRaw = formData.get('unit_cost');
  const reorderPointRaw = formData.get('reorder_point');
  const reorderQtyRaw = formData.get('reorder_quantity');
  const maxStockRaw = formData.get('max_stock');
  return {
    name: ((formData.get('name') as string) || '').trim() || undefined,
    description: ((formData.get('description') as string) || '').trim() || null,
    sku: ((formData.get('sku') as string) || '').trim() || null,
    barcode: ((formData.get('barcode') as string) || '').trim() || null,
    unit_of_measure: ((formData.get('unit_of_measure') as string) || '').trim() || null,
    department: ((formData.get('department') as string) || '').trim() || undefined,
    category: ((formData.get('category') as string) || '').trim() || null,
    unit_cost: unitCostRaw ? Number(unitCostRaw) || null : null,
    reorder_point: reorderPointRaw ? Number(reorderPointRaw) || null : null,
    reorder_quantity: reorderQtyRaw ? Number(reorderQtyRaw) || null : null,
    max_stock: maxStockRaw ? Number(maxStockRaw) || null : null,
    primary_supply_house_id: ((formData.get('primary_supply_house_id') as string) || '').trim() || null,
    secondary_supply_house_id: ((formData.get('secondary_supply_house_id') as string) || '').trim() || null,
  };
}

export async function createMaterialAction(formData: FormData) {
  await requireRole();
  const material = await createMaterial(readMaterialForm(formData));
  revalidatePath('/materials');
  redirect(`/materials/${material.id}`);
}

export async function updateMaterialAction(materialId: string, formData: FormData) {
  await requireRole();
  await updateMaterial(materialId, readMaterialForm(formData));
  revalidatePath('/materials');
  revalidatePath(`/materials/${materialId}`);
  redirect(`/materials/${materialId}`);
}
