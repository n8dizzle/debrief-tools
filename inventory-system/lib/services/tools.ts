import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface Tool {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  barcode: string;
  department: string;
  status: string;
  home_warehouse_id: string;
  category: string | null;
  [k: string]: unknown;
}

export async function listTools(filter: { department?: string | null; status?: string | null; category?: string | null; warehouseId?: string | null }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.department) { params.push(filter.department); conditions.push(`t.department = $${params.length}`); }
  if (filter.status) { params.push(filter.status); conditions.push(`t.status = $${params.length}`); }
  if (filter.category) { params.push(filter.category); conditions.push(`t.category = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`t.home_warehouse_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query(
    `SELECT t.*,
            w.name AS home_warehouse_name,
            u.first_name || ' ' || u.last_name AS checked_out_to_name,
            tr.truck_number AS checked_out_truck_number
       FROM tools t
       JOIN warehouses w ON w.id = t.home_warehouse_id
       LEFT JOIN users u ON u.id = t.checked_out_to
       LEFT JOIN trucks tr ON tr.id = t.checked_out_truck
      ${where}
      ORDER BY t.category, t.name`,
    params,
  );
  return rows;
}

export async function getToolByBarcode(barcode: string) {
  const { rows } = await query(
    `SELECT t.*, w.name AS home_warehouse_name,
            u.first_name || ' ' || u.last_name AS checked_out_to_name
       FROM tools t
       JOIN warehouses w ON w.id = t.home_warehouse_id
       LEFT JOIN users u ON u.id = t.checked_out_to
      WHERE t.barcode = $1`,
    [barcode],
  );
  if (!rows[0]) throw new AppError('Tool not found for barcode', 404);
  return rows[0];
}

export async function getTool(id: string) {
  const [tool, hist] = await Promise.all([
    query(
      `SELECT t.*, w.name AS home_warehouse_name,
              u.first_name || ' ' || u.last_name AS checked_out_to_name,
              tr.truck_number AS checked_out_truck_number
         FROM tools t
         JOIN warehouses w ON w.id = t.home_warehouse_id
         LEFT JOIN users u ON u.id = t.checked_out_to
         LEFT JOIN trucks tr ON tr.id = t.checked_out_truck
        WHERE t.id = $1`,
      [id],
    ),
    query(
      `SELECT tm.*,
              u.first_name || ' ' || u.last_name AS performed_by_name,
              tech.first_name || ' ' || tech.last_name AS technician_name,
              tr.truck_number
         FROM tool_movements tm
         LEFT JOIN users u ON u.id = tm.performed_by
         LEFT JOIN users tech ON tech.id = tm.technician_id
         LEFT JOIN trucks tr ON tr.id = tm.truck_id
        WHERE tm.tool_id = $1
        ORDER BY tm.created_at DESC
        LIMIT 50`,
      [id],
    ),
  ]);
  if (!tool.rows[0]) throw new AppError('Tool not found', 404);
  return { tool: tool.rows[0], history: hist.rows };
}

export interface ToolInput {
  name?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  barcode?: string;
  department?: string;
  home_warehouse_id?: string;
  category?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  warranty_expiry?: string | null;
  current_condition?: string | null;
  status?: string | null;
  notes?: string | null;
}

export async function createTool(b: ToolInput) {
  if (!b.name || !b.manufacturer || !b.model || !b.serial_number || !b.barcode || !b.department || !b.home_warehouse_id) {
    throw new AppError('name, manufacturer, model, serial_number, barcode, department, home_warehouse_id required', 400);
  }
  const { rows } = await query(
    `INSERT INTO tools (name, manufacturer, model, serial_number, barcode, department, home_warehouse_id, category, purchase_date, purchase_cost, warranty_expiry, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [b.name, b.manufacturer, b.model, b.serial_number, b.barcode, b.department, b.home_warehouse_id,
     b.category ?? null, b.purchase_date ?? null, b.purchase_cost ?? null, b.warranty_expiry ?? null, b.notes ?? null],
  );
  return rows[0];
}

export async function updateTool(id: string, b: ToolInput) {
  const { rows } = await query(
    `UPDATE tools
        SET name              = COALESCE($1, name),
            category          = COALESCE($2, category),
            purchase_date     = COALESCE($3, purchase_date),
            purchase_cost     = COALESCE($4, purchase_cost),
            warranty_expiry   = COALESCE($5, warranty_expiry),
            current_condition = COALESCE($6, current_condition),
            status            = COALESCE($7, status),
            notes             = COALESCE($8, notes),
            updated_at        = NOW()
      WHERE id = $9
      RETURNING *`,
    [b.name ?? null, b.category ?? null, b.purchase_date ?? null, b.purchase_cost ?? null, b.warranty_expiry ?? null,
     b.current_condition ?? null, b.status ?? null, b.notes ?? null, id],
  );
  if (!rows[0]) throw new AppError('Tool not found', 404);
  return rows[0];
}

export interface CheckoutInput {
  technician_id: string;
  truck_id?: string | null;
  st_job_id?: string | null;
  condition?: string | null;
  notes?: string | null;
}

export async function checkoutTool(toolId: string, b: CheckoutInput, performedBy: string) {
  return transaction(async (q) => {
    const { rows } = await q<Tool>(`SELECT * FROM tools WHERE id = $1`, [toolId]);
    const tool = rows[0];
    if (!tool) throw new AppError('Tool not found', 404);
    if (tool.status !== 'available') throw new AppError(`Tool is not available (current: ${tool.status})`, 400, 'TOOL_NOT_AVAILABLE');

    const { rows: updRows } = await q(
      `UPDATE tools
          SET status = 'checked_out', checked_out_to = $1, checked_out_truck = $2,
              checked_out_at = NOW(), checked_out_job = $3,
              current_condition = COALESCE($4, current_condition), updated_at = NOW()
        WHERE id = $5 RETURNING *`,
      [b.technician_id, b.truck_id ?? null, b.st_job_id ?? null, b.condition ?? null, toolId],
    );
    await q(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, technician_id, truck_id, st_job_id, condition_at_time, notes)
       VALUES ($1,'checkout',$2,$3,$4,$5,$6,$7)`,
      [toolId, performedBy, b.technician_id, b.truck_id ?? null, b.st_job_id ?? null,
       b.condition ?? tool.current_condition ?? null, b.notes ?? null],
    );
    return updRows[0];
  });
}

export async function checkinTool(toolId: string, b: { condition?: string | null; notes?: string | null }, performedBy: string) {
  return transaction(async (q) => {
    const { rows } = await q<Tool>(`SELECT * FROM tools WHERE id = $1`, [toolId]);
    const tool = rows[0];
    if (!tool) throw new AppError('Tool not found', 404);
    if (tool.status !== 'checked_out') throw new AppError(`Tool is not checked out (current: ${tool.status})`, 400);

    const newCondition = b.condition ?? tool.current_condition ?? null;
    const newStatus = newCondition === 'needs_service' || newCondition === 'damaged' ? 'out_for_service' : 'available';

    const { rows: updRows } = await q(
      `UPDATE tools
          SET status = $1, current_condition = $2,
              checked_out_to = NULL, checked_out_truck = NULL,
              checked_out_at = NULL, checked_out_job = NULL, updated_at = NOW()
        WHERE id = $3 RETURNING *`,
      [newStatus, newCondition, toolId],
    );
    await q(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, condition_at_time, notes)
       VALUES ($1,'checkin',$2,$3,$4)`,
      [toolId, performedBy, newCondition, b.notes ?? null],
    );
    return updRows[0];
  });
}

export async function sendToolForService(toolId: string, b: { notes?: string | null }, performedBy: string) {
  return transaction(async (q) => {
    const { rows } = await q<Tool>(`SELECT * FROM tools WHERE id = $1`, [toolId]);
    if (!rows[0]) throw new AppError('Tool not found', 404);
    const { rows: updRows } = await q(
      `UPDATE tools SET status = 'out_for_service', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [toolId],
    );
    await q(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, notes) VALUES ($1,'service_out',$2,$3)`,
      [toolId, performedBy, b.notes ?? null],
    );
    return updRows[0];
  });
}
