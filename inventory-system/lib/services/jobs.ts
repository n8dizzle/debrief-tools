import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';

export interface JobRow {
  id: string;
  truck_id: string | null;
  technician_id: string | null;
  status: string;
  scheduled_at: string | null;
  truck_number: string | null;
  technician_name: string | null;
  [key: string]: unknown;
}

export async function listJobs(filter: { truckId?: string | null; status?: string | null; limit?: number; offset?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.truckId) {
    params.push(filter.truckId);
    conditions.push(`j.truck_id = $${params.length}`);
  }

  if (filter.status) {
    const statuses = filter.status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      params.push(statuses[0]);
      conditions.push(`j.status = $${params.length}`);
    } else if (statuses.length > 1) {
      params.push(statuses);
      conditions.push(`j.status = ANY($${params.length})`);
    }
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);

  try {
    const { rows } = await query<JobRow>(
      `SELECT j.*,
              t.truck_number,
              u.first_name || ' ' || u.last_name AS technician_name
         FROM st_jobs j
         LEFT JOIN trucks t ON t.id = j.truck_id
         LEFT JOIN users u ON u.id = j.technician_id
        ${where}
        ORDER BY
          CASE j.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
          j.scheduled_at ASC NULLS LAST,
          j.updated_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  } catch (e) {
    // st_jobs table is created by the ST jobs sync; return empty if it doesn't exist yet.
    if ((e as { code?: string }).code === '42P01') return [];
    throw e;
  }
}

export async function getJob(id: string): Promise<JobRow> {
  const { rows } = await query<JobRow>(
    `SELECT j.*,
            t.truck_number,
            u.first_name || ' ' || u.last_name AS technician_name
       FROM st_jobs j
       LEFT JOIN trucks t ON t.id = j.truck_id
       LEFT JOIN users u ON u.id = j.technician_id
      WHERE j.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AppError('Job not found', 404);
  return rows[0];
}
