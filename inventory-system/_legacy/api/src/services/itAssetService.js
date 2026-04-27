'use strict';

const { transaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function assign(assetId, userId, assignedBy, notes) {
  return transaction(async (client) => {
    const { rows: [asset] } = await client.query(
      `SELECT * FROM it_assets WHERE id = $1`,
      [assetId],
    );
    if (!asset) throw new AppError('IT asset not found', 404);
    if (asset.status === 'assigned') {
      throw new AppError('Asset is already assigned — unassign first', 400, 'ALREADY_ASSIGNED');
    }
    if (asset.status === 'retired') {
      throw new AppError('Cannot assign a retired asset', 400);
    }

    const { rows: [updated] } = await client.query(
      `UPDATE it_assets
          SET status      = 'assigned',
              assigned_to = $1,
              assigned_at = NOW(),
              updated_at  = NOW()
        WHERE id = $2
        RETURNING *`,
      [userId, assetId],
    );

    await client.query(
      `INSERT INTO it_asset_assignments (asset_id, assigned_to, assigned_by, notes)
       VALUES ($1,$2,$3,$4)`,
      [assetId, userId, assignedBy, notes],
    );

    return updated;
  });
}

async function unassign(assetId, assignedBy, returnNotes) {
  return transaction(async (client) => {
    const { rows: [asset] } = await client.query(
      `SELECT * FROM it_assets WHERE id = $1`,
      [assetId],
    );
    if (!asset) throw new AppError('IT asset not found', 404);
    if (asset.status !== 'assigned') {
      throw new AppError('Asset is not currently assigned', 400);
    }

    // Close the current assignment record
    await client.query(
      `UPDATE it_asset_assignments
          SET returned_at  = NOW(),
              return_notes = $1
        WHERE asset_id = $2 AND returned_at IS NULL`,
      [returnNotes, assetId],
    );

    const { rows: [updated] } = await client.query(
      `UPDATE it_assets
          SET status      = 'unassigned',
              assigned_to = NULL,
              assigned_at = NULL,
              updated_at  = NOW()
        WHERE id = $1
        RETURNING *`,
      [assetId],
    );

    return updated;
  });
}

module.exports = { assign, unassign };
