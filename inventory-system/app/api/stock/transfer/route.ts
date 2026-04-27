import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { recordMovement } from '@/lib/services/material-movements';
import { query } from '@/lib/db';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface TransferBody {
  material_id: string;
  from_type: 'warehouse' | 'truck';
  from_id: string;
  to_type: 'warehouse' | 'truck';
  to_id: string;
  quantity: number;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    const body = (await req.json()) as Partial<TransferBody>;
    if (!body.material_id || !body.from_type || !body.from_id || !body.to_type || !body.to_id || !body.quantity) {
      throw new AppError('material_id, from_type, from_id, to_type, to_id, quantity required', 400);
    }
    const { material_id, from_type, from_id, to_type, to_id, quantity, notes } = body as TransferBody;

    if (from_type === to_type && from_id === to_id) {
      throw new AppError('Source and destination cannot be the same.', 400);
    }

    let fromName: string;
    let toName: string;

    if (from_type === 'warehouse') {
      const { rows } = await query<{ name: string }>(`SELECT name FROM warehouses WHERE id = $1`, [from_id]);
      if (!rows[0]) throw new AppError('Source warehouse not found.', 404);
      fromName = rows[0].name;
    } else {
      const { rows } = await query<{ truck_number: string }>(`SELECT truck_number FROM trucks WHERE id = $1`, [from_id]);
      if (!rows[0]) throw new AppError('Source truck not found.', 404);
      fromName = `Truck ${rows[0].truck_number}`;
    }

    if (to_type === 'warehouse') {
      const { rows } = await query<{ name: string }>(`SELECT name FROM warehouses WHERE id = $1`, [to_id]);
      if (!rows[0]) throw new AppError('Destination warehouse not found.', 404);
      toName = rows[0].name;
    } else {
      const { rows } = await query<{ truck_number: string }>(`SELECT truck_number FROM trucks WHERE id = $1`, [to_id]);
      if (!rows[0]) throw new AppError('Destination truck not found.', 404);
      toName = `Truck ${rows[0].truck_number}`;
    }

    // Check source has sufficient stock
    if (from_type === 'warehouse') {
      const { rows } = await query<{ quantity_on_hand: number }>(
        `SELECT quantity_on_hand FROM warehouse_stock WHERE material_id = $1 AND warehouse_id = $2`,
        [material_id, from_id],
      );
      const avail = rows[0]?.quantity_on_hand ?? 0;
      if (avail < quantity) throw new AppError(`Insufficient stock — ${avail} available at ${fromName}.`, 400);
    } else {
      const { rows } = await query<{ quantity_on_hand: number }>(
        `SELECT quantity_on_hand FROM truck_stock WHERE material_id = $1 AND truck_id = $2`,
        [material_id, from_id],
      );
      const avail = rows[0]?.quantity_on_hand ?? 0;
      if (avail < quantity) throw new AppError(`Insufficient stock — ${avail} available on ${fromName}.`, 400);
    }

    const matRes = await query<{ name: string; sku: string }>(
      `SELECT name, sku FROM materials WHERE id = $1`,
      [material_id],
    );
    if (!matRes.rows[0]) throw new AppError('Material not found.', 404);
    const material = matRes.rows[0];

    const movement = await recordMovement({
      material_id,
      movement_type: 'transferred',
      quantity,
      from_warehouse_id: from_type === 'warehouse' ? from_id : null,
      from_truck_id: from_type === 'truck' ? from_id : null,
      to_warehouse_id: to_type === 'warehouse' ? to_id : null,
      to_truck_id: to_type === 'truck' ? to_id : null,
      notes: notes ?? null,
      performed_by: user.id,
    });

    return NextResponse.json({
      transfer_id: movement.id,
      quantity,
      material: { id: material_id, name: material.name, sku: material.sku },
      from: { id: from_id, type: from_type, name: fromName },
      to: { id: to_id, type: to_type, name: toName },
      notes: notes ?? null,
    }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
