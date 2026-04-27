import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';

export interface SupplyHouse {
  id: string;
  name: string;
  account_number: string | null;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  department: string | null;
  lead_time_days: number | null;
  preferred_po_day: number | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplyHouseListRow extends SupplyHouse {
  open_po_count: string;
}

export async function listSupplyHouses(filter: { department?: string | null; isActive?: boolean | null } = {}) {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.department) {
    params.push(filter.department);
    conditions.push(`(department = $${params.length} OR department IS NULL)`);
  }
  if (filter.isActive !== null && filter.isActive !== undefined) {
    params.push(filter.isActive);
    conditions.push(`is_active = $${params.length}`);
  }

  const { rows } = await query<SupplyHouseListRow>(
    `SELECT sh.*,
            (SELECT COUNT(*) FROM purchase_orders po WHERE po.supply_house_id = sh.id AND po.status NOT IN ('cancelled')) AS open_po_count
       FROM supply_houses sh
      WHERE ${conditions.join(' AND ')}
      ORDER BY sh.name`,
    params,
  );
  return rows;
}

export async function getSupplyHouse(id: string): Promise<SupplyHouse> {
  const { rows } = await query<SupplyHouse>(`SELECT * FROM supply_houses WHERE id = $1`, [id]);
  if (!rows[0]) throw new AppError('Supply house not found', 404);
  return rows[0];
}

export interface SupplyHouseInput {
  name?: string;
  account_number?: string | null;
  contact_name?: string | null;
  contact_email?: string;
  contact_phone?: string | null;
  department?: string | null;
  lead_time_days?: number | null;
  preferred_po_day?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
}

export async function createSupplyHouse(b: SupplyHouseInput): Promise<SupplyHouse> {
  if (!b.name || !b.contact_email) throw new AppError('name and contact_email are required', 400);
  const { rows } = await query<SupplyHouse>(
    `INSERT INTO supply_houses (name, account_number, contact_name, contact_email, contact_phone, department, lead_time_days, preferred_po_day, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [b.name, b.account_number ?? null, b.contact_name ?? null, b.contact_email, b.contact_phone ?? null,
     b.department ?? null, b.lead_time_days ?? null, b.preferred_po_day ?? null, b.notes ?? null],
  );
  return rows[0];
}

export async function updateSupplyHouse(id: string, b: SupplyHouseInput): Promise<SupplyHouse> {
  const { rows } = await query<SupplyHouse>(
    `UPDATE supply_houses
        SET name             = COALESCE($1, name),
            account_number   = COALESCE($2, account_number),
            contact_name     = COALESCE($3, contact_name),
            contact_email    = COALESCE($4, contact_email),
            contact_phone    = COALESCE($5, contact_phone),
            department       = COALESCE($6, department),
            lead_time_days   = COALESCE($7, lead_time_days),
            preferred_po_day = COALESCE($8, preferred_po_day),
            notes            = COALESCE($9, notes),
            is_active        = COALESCE($10, is_active),
            updated_at       = NOW()
      WHERE id = $11
      RETURNING *`,
    [b.name ?? null, b.account_number ?? null, b.contact_name ?? null, b.contact_email ?? null,
     b.contact_phone ?? null, b.department ?? null, b.lead_time_days ?? null,
     b.preferred_po_day ?? null, b.notes ?? null, b.is_active ?? null, id],
  );
  if (!rows[0]) throw new AppError('Supply house not found', 404);
  return rows[0];
}
