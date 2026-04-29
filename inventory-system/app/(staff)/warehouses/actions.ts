'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { submitCycleCount } from '@/lib/services/material-movements';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

export async function updateWarehouseStockMinMax(warehouseId: string, stockId: string, formData: FormData) {
  await requireRole();
  const min = Number(formData.get('min') ?? 0);
  const maxRaw = formData.get('max');
  const max = maxRaw && String(maxRaw).trim() !== '' ? Number(maxRaw) : null;
  await query(
    `UPDATE warehouse_stock SET min_quantity = $1, max_quantity = $2 WHERE id = $3`,
    [min, max, stockId],
  );
  revalidatePath(`/warehouses/${warehouseId}`);
}

export async function submitCycleCountAction(warehouseId: string, formData: FormData) {
  const s = await requireRole();

  // Form fields named qty[<material_id>] (value may be blank = skip)
  const counts: Array<{ material_id: string; counted_qty: number; notes?: string | null }> = [];

  for (const [key, raw] of formData.entries()) {
    const match = /^qty\[(.+)\]$/.exec(key);
    if (!match) continue;
    const materialId = match[1];
    const trimmed = String(raw).trim();
    if (trimmed === '') continue; // blank = skip
    const counted = Number(trimmed);
    if (!Number.isFinite(counted)) continue;
    const notes = (formData.get(`notes[${materialId}]`) as string)?.trim() || null;
    counts.push({ material_id: materialId, counted_qty: counted, notes });
  }

  if (counts.length > 0) {
    await submitCycleCount({
      warehouse_id: warehouseId,
      counts,
      performed_by: s.user.id,
    });
  }

  revalidatePath(`/warehouses/${warehouseId}`);
  redirect(`/warehouses/${warehouseId}`);
}

export async function createWarehouseAction(formData: FormData) {
  await requireRole();
  const name = ((formData.get('name') as string) || '').trim();
  const code = ((formData.get('code') as string) || '').trim();
  const department = ((formData.get('department') as string) || '').trim() || 'all';
  const address = ((formData.get('address') as string) || '').trim() || null;
  const city = ((formData.get('city') as string) || '').trim() || null;
  const state = ((formData.get('state') as string) || '').trim() || null;
  const zip = ((formData.get('zip') as string) || '').trim() || null;
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const managerId = ((formData.get('manager_id') as string) || '').trim() || null;

  if (!name || !code) throw new Error('name and code are required');

  const { rows } = await query<{ id: string }>(
    `INSERT INTO warehouses (name, code, department, address, city, state, zip, phone, manager_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
     RETURNING id`,
    [name, code, department, address, city, state, zip, phone, managerId],
  );

  revalidatePath('/warehouses');
  redirect(`/warehouses/${rows[0].id}`);
}

export async function updateWarehouseAction(warehouseId: string, formData: FormData) {
  await requireRole();
  const name = ((formData.get('name') as string) || '').trim() || null;
  const department = ((formData.get('department') as string) || '').trim() || null;
  const address = ((formData.get('address') as string) || '').trim() || null;
  const city = ((formData.get('city') as string) || '').trim() || null;
  const state = ((formData.get('state') as string) || '').trim() || null;
  const zip = ((formData.get('zip') as string) || '').trim() || null;
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const managerId = ((formData.get('manager_id') as string) || '').trim() || null;

  await query(
    `UPDATE warehouses
        SET name       = COALESCE($1, name),
            department = COALESCE($2, department),
            address    = COALESCE($3, address),
            city       = COALESCE($4, city),
            state      = COALESCE($5, state),
            zip        = COALESCE($6, zip),
            phone      = COALESCE($7, phone),
            manager_id = COALESCE($8, manager_id),
            updated_at = NOW()
      WHERE id = $9`,
    [name, department, address, city, state, zip, phone, managerId, warehouseId],
  );

  revalidatePath('/warehouses');
  revalidatePath(`/warehouses/${warehouseId}`);
  redirect(`/warehouses/${warehouseId}`);
}
