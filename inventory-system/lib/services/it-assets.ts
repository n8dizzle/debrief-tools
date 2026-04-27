import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface ItAssetRow {
  id: string;
  asset_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  [k: string]: unknown;
}

export async function listItAssets(filter: {
  assetType?: string | null;
  status?: string | null;
  department?: string | null;
  assignedTo?: string | null;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.assetType) { params.push(filter.assetType); conditions.push(`a.asset_type = $${params.length}`); }
  if (filter.status) { params.push(filter.status); conditions.push(`a.status = $${params.length}`); }
  if (filter.department) { params.push(filter.department); conditions.push(`a.department = $${params.length}`); }
  if (filter.assignedTo) { params.push(filter.assignedTo); conditions.push(`a.assigned_to = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query<ItAssetRow>(
    `SELECT a.*,
            u.first_name || ' ' || u.last_name AS assigned_to_name,
            u.email AS assigned_to_email
       FROM it_assets a
       LEFT JOIN users u ON u.id = a.assigned_to
      ${where}
      ORDER BY a.asset_type, a.model`,
    params,
  );
  return rows;
}

export async function getItAsset(id: string) {
  const [assetRes, histRes] = await Promise.all([
    query<ItAssetRow>(
      `SELECT a.*, u.first_name || ' ' || u.last_name AS assigned_to_name
         FROM it_assets a
         LEFT JOIN users u ON u.id = a.assigned_to
        WHERE a.id = $1`,
      [id],
    ),
    query(
      `SELECT h.*,
              a.first_name || ' ' || a.last_name AS assigned_to_name,
              b.first_name || ' ' || b.last_name AS assigned_by_name
         FROM it_asset_assignments h
         LEFT JOIN users a ON a.id = h.assigned_to
         LEFT JOIN users b ON b.id = h.assigned_by
        WHERE h.asset_id = $1
        ORDER BY h.assigned_at DESC`,
      [id],
    ),
  ]);
  if (!assetRes.rows[0]) throw new AppError('IT asset not found', 404);
  return { asset: assetRes.rows[0], history: histRes.rows };
}

export interface ItAssetInput {
  asset_type?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  imei?: string | null;
  udid?: string | null;
  asset_tag?: string | null;
  department?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  vendor?: string | null;
  warranty_expiry?: string | null;
  mdm_enrolled?: boolean | null;
  carrier?: string | null;
  phone_number?: string | null;
  notes?: string | null;
  status?: string | null;
}

export async function createItAsset(b: ItAssetInput) {
  if (!b.asset_type || !b.manufacturer || !b.model || !b.serial_number) {
    throw new AppError('asset_type, manufacturer, model, serial_number required', 400);
  }
  const { rows } = await query<ItAssetRow>(
    `INSERT INTO it_assets
       (asset_type, manufacturer, model, serial_number, imei, udid, asset_tag,
        department, purchase_date, purchase_cost, vendor, warranty_expiry,
        mdm_enrolled, carrier, phone_number, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [b.asset_type, b.manufacturer, b.model, b.serial_number, b.imei ?? null, b.udid ?? null,
     b.asset_tag ?? null, b.department ?? null, b.purchase_date ?? null, b.purchase_cost ?? null,
     b.vendor ?? null, b.warranty_expiry ?? null, b.mdm_enrolled ?? null, b.carrier ?? null,
     b.phone_number ?? null, b.notes ?? null],
  );
  return rows[0];
}

export async function updateItAsset(id: string, b: ItAssetInput) {
  const { rows } = await query<ItAssetRow>(
    `UPDATE it_assets
        SET manufacturer    = COALESCE($1, manufacturer),
            model           = COALESCE($2, model),
            asset_tag       = COALESCE($3, asset_tag),
            warranty_expiry = COALESCE($4, warranty_expiry),
            mdm_enrolled    = COALESCE($5, mdm_enrolled),
            carrier         = COALESCE($6, carrier),
            phone_number    = COALESCE($7, phone_number),
            status          = COALESCE($8, status),
            notes           = COALESCE($9, notes),
            updated_at      = NOW()
      WHERE id = $10
      RETURNING *`,
    [b.manufacturer ?? null, b.model ?? null, b.asset_tag ?? null, b.warranty_expiry ?? null,
     b.mdm_enrolled ?? null, b.carrier ?? null, b.phone_number ?? null, b.status ?? null,
     b.notes ?? null, id],
  );
  if (!rows[0]) throw new AppError('IT asset not found', 404);
  return rows[0];
}

export async function assignAsset(assetId: string, userId: string, assignedBy: string, notes?: string | null) {
  return transaction(async (q) => {
    const { rows } = await q<ItAssetRow>(`SELECT * FROM it_assets WHERE id = $1`, [assetId]);
    const asset = rows[0];
    if (!asset) throw new AppError('IT asset not found', 404);
    if (asset.status === 'assigned') throw new AppError('Asset is already assigned — unassign first', 400, 'ALREADY_ASSIGNED');
    if (asset.status === 'retired') throw new AppError('Cannot assign a retired asset', 400);

    const { rows: updatedRows } = await q<ItAssetRow>(
      `UPDATE it_assets
          SET status = 'assigned', assigned_to = $1, assigned_at = NOW(), updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [userId, assetId],
    );
    await q(
      `INSERT INTO it_asset_assignments (asset_id, assigned_to, assigned_by, notes) VALUES ($1,$2,$3,$4)`,
      [assetId, userId, assignedBy, notes ?? null],
    );
    return updatedRows[0];
  });
}

export async function unassignAsset(assetId: string, _assignedBy: string, returnNotes?: string | null) {
  void _assignedBy;
  return transaction(async (q) => {
    const { rows } = await q<ItAssetRow>(`SELECT * FROM it_assets WHERE id = $1`, [assetId]);
    const asset = rows[0];
    if (!asset) throw new AppError('IT asset not found', 404);
    if (asset.status !== 'assigned') throw new AppError('Asset is not currently assigned', 400);

    await q(
      `UPDATE it_asset_assignments SET returned_at = NOW(), return_notes = $1
         WHERE asset_id = $2 AND returned_at IS NULL`,
      [returnNotes ?? null, assetId],
    );
    const { rows: updatedRows } = await q<ItAssetRow>(
      `UPDATE it_assets
          SET status = 'unassigned', assigned_to = NULL, assigned_at = NULL, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [assetId],
    );
    return updatedRows[0];
  });
}
