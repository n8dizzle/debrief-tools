'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { createPO, addPOLine, recalcTotals } from '@/lib/services/purchase-orders';
import { AppError } from '@/lib/errors';

const MANAGER_ROLES = new Set(['admin', 'warehouse_manager']);

export async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!MANAGER_ROLES.has(s.user.role)) redirect('/dashboard');
  return s;
}

interface LineItem {
  material_id: string;
  quantity_ordered: number;
  unit_cost?: number | string | null;
  notes?: string | null;
}

export async function createPOAction(formData: FormData) {
  const s = await requireRole();

  const supply_house_id = (formData.get('supply_house_id') as string)?.trim();
  const warehouse_id = (formData.get('warehouse_id') as string)?.trim();
  const department = (formData.get('department') as string)?.trim() || 'plumbing';
  const notes = (formData.get('notes') as string)?.trim() || null;
  const expected_delivery = (formData.get('expected_delivery') as string)?.trim() || null;

  if (!supply_house_id) throw new AppError('Vendor is required', 400);
  if (!warehouse_id) throw new AppError('Warehouse is required', 400);

  // Parse line items from the serialized JSON hidden field
  let lines: LineItem[] = [];
  const linesJson = formData.get('lines_json') as string | null;
  if (linesJson) {
    try {
      lines = JSON.parse(linesJson) as LineItem[];
    } catch {
      throw new AppError('Invalid line items', 400);
    }
  }

  const validLines = lines.filter(
    (l) => l.material_id?.trim() && Number(l.quantity_ordered) > 0,
  );

  const po = await createPO({
    supply_house_id,
    warehouse_id,
    department,
    trigger_type: 'manual',
    notes,
    review_deadline: expected_delivery
      ? new Date(expected_delivery).toISOString()
      : null,
    created_by: s.user.id,
  });

  for (const line of validLines) {
    const unitCost =
      line.unit_cost != null && line.unit_cost !== ''
        ? Number(line.unit_cost)
        : null;
    await addPOLine(po.id, {
      material_id: line.material_id,
      quantity_ordered: Number(line.quantity_ordered),
      unit_cost: unitCost,
      notes: line.notes?.trim() || null,
    });
  }

  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${po.id}`);
}

export async function updatePOStatusAction(poId: string, status: string) {
  await requireRole();

  const VALID_STATUSES = ['draft', 'pending_review', 'sent', 'partially_received', 'received', 'cancelled'];
  if (!VALID_STATUSES.includes(status)) throw new AppError('Invalid status', 400);

  await query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, poId],
  );

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/purchase-orders');
}
