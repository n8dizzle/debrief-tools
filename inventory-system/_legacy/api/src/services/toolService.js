'use strict';

const { transaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function checkout(toolId, { technician_id, truck_id, st_job_id, condition, notes }, performedBy) {
  return transaction(async (client) => {
    const { rows: [tool] } = await client.query(
      `SELECT * FROM tools WHERE id = $1`,
      [toolId],
    );

    if (!tool) throw new AppError('Tool not found', 404);
    if (tool.status !== 'available') {
      throw new AppError(`Tool is not available (current status: ${tool.status})`, 400, 'TOOL_NOT_AVAILABLE');
    }

    const { rows: [updated] } = await client.query(
      `UPDATE tools
          SET status           = 'checked_out',
              checked_out_to   = $1,
              checked_out_truck= $2,
              checked_out_at   = NOW(),
              checked_out_job  = $3,
              current_condition= COALESCE($4, current_condition),
              updated_at       = NOW()
        WHERE id = $5
        RETURNING *`,
      [technician_id, truck_id, st_job_id, condition, toolId],
    );

    await client.query(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, technician_id, truck_id, st_job_id, condition_at_time, notes)
       VALUES ($1,'checkout',$2,$3,$4,$5,$6,$7)`,
      [toolId, performedBy, technician_id, truck_id, st_job_id, condition || tool.current_condition, notes],
    );

    return updated;
  });
}

async function checkin(toolId, { condition, notes }, performedBy) {
  return transaction(async (client) => {
    const { rows: [tool] } = await client.query(
      `SELECT * FROM tools WHERE id = $1`,
      [toolId],
    );

    if (!tool) throw new AppError('Tool not found', 404);
    if (tool.status !== 'checked_out') {
      throw new AppError(`Tool is not checked out (current status: ${tool.status})`, 400);
    }

    const newCondition = condition || tool.current_condition;
    const newStatus = newCondition === 'needs_service' || newCondition === 'damaged'
      ? 'out_for_service'
      : 'available';

    const { rows: [updated] } = await client.query(
      `UPDATE tools
          SET status            = $1,
              current_condition = $2,
              checked_out_to    = NULL,
              checked_out_truck = NULL,
              checked_out_at    = NULL,
              checked_out_job   = NULL,
              updated_at        = NOW()
        WHERE id = $3
        RETURNING *`,
      [newStatus, newCondition, toolId],
    );

    await client.query(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, condition_at_time, notes)
       VALUES ($1,'checkin',$2,$3,$4)`,
      [toolId, performedBy, newCondition, notes],
    );

    return updated;
  });
}

async function sendForService(toolId, { notes }, performedBy) {
  return transaction(async (client) => {
    const { rows: [tool] } = await client.query(`SELECT * FROM tools WHERE id = $1`, [toolId]);
    if (!tool) throw new AppError('Tool not found', 404);

    const { rows: [updated] } = await client.query(
      `UPDATE tools SET status = 'out_for_service', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [toolId],
    );

    await client.query(
      `INSERT INTO tool_movements (tool_id, movement_type, performed_by, notes)
       VALUES ($1,'service_out',$2,$3)`,
      [toolId, performedBy, notes],
    );

    return updated;
  });
}

module.exports = { checkout, checkin, sendForService };
