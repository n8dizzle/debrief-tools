'use strict';

/**
 * ServiceTitan API Service
 *
 * Handles OAuth2 token management and data sync for:
 *   - Pricebook items → materials table
 *   - Equipment       → equipment table
 *   - Technicians     → users table
 *   - Vehicles        → trucks table
 *
 * ST API docs: https://developer.servicetitan.io/apis/
 *
 * Token flow: Client Credentials (tenant + app key scoped)
 */

const axios = require('axios');
const { query } = require('../config/db');
const env = require('../config/env');

// ── Token cache (in-memory, single instance) ─────────────────────────────────

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token;

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     env.st.clientId,
    client_secret: env.st.clientSecret,
  });

  const { data } = await axios.post(env.st.authUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  _token = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _token;
}

function stApi() {
  return {
    async get(path, params = {}) {
      const token = await getToken();
      // path format: "/{module}/v2/{endpoint}"  →  "/{module}/v2/tenant/{tenantId}/{endpoint}"
      const url = path.replace(/^\/([^/]+)\/v2\//, `/$1/v2/tenant/${env.st.tenantId}/`);
      const { data } = await axios.get(`${env.st.baseUrl}${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': env.st.appKey,
        },
        params: { pageSize: 500, ...params },
      });
      return data;
    },
    async getAll(path, params = {}) {
      // Auto-paginate through all results
      const results = [];
      let page = 1;
      while (true) {
        const data = await this.get(path, { ...params, page });
        results.push(...(data.data ?? []));
        if (!data.hasMore) break;
        page++;
      }
      return results;
    },
  };
}

// ── Sync log helper ────────────────────────────────────────────────────────────

async function writeSyncLog(syncType, status, recordsSynced, recordsFailed, errorDetail) {
  await query(
    `INSERT INTO st_sync_log (sync_type, status, records_synced, records_failed, error_detail, completed_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [syncType, status, recordsSynced, recordsFailed, errorDetail],
  );
}

// ── Pricebook → materials ─────────────────────────────────────────────────────

async function syncPricebook() {
  const startedAt = new Date();
  let synced = 0, failed = 0;

  try {
    const api = stApi();
    const items = await api.getAll('/pricebook/v2/materials');

    for (const item of items) {
      try {
        // Infer department from ST business unit name (plumbing vs hvac). Fallback 'general'.
        const buName = (item.businessUnit?.name || '').toLowerCase();
        const department = buName.includes('plumb') ? 'plumbing'
                         : buName.includes('hvac') || buName.includes('ac') ? 'hvac'
                         : 'plumbing';

        await query(
          `INSERT INTO materials (st_pricebook_id, sku, name, description, unit_cost, unit_of_measure, category, department, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT (st_pricebook_id) DO UPDATE SET
             name            = COALESCE(EXCLUDED.name, materials.name),
             description     = COALESCE(EXCLUDED.description, materials.description),
             unit_cost       = COALESCE(EXCLUDED.unit_cost, materials.unit_cost),
             unit_of_measure = COALESCE(EXCLUDED.unit_of_measure, materials.unit_of_measure),
             category        = COALESCE(EXCLUDED.category, materials.category),
             department      = COALESCE(EXCLUDED.department, materials.department),
             is_active       = EXCLUDED.is_active,
             updated_at      = NOW()`,
          [
            String(item.id),
            item.code || String(item.id),
            item.displayName || item.description || 'Untitled',
            item.description || null,
            item.cost ?? null,  // ST pricebook "cost" = our unit cost (not "price", which is customer-facing)
            item.unitOfMeasure || null,
            item.categories?.[0]?.name || null,
            department,
            item.active !== false,
          ],
        );
        synced++;
      } catch (e) {
        console.warn(`Pricebook item ${item.id} failed:`, e.message);
        failed++;
      }
    }

    await writeSyncLog('pricebook', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('pricebook', 'failed', synced, failed, err.message);
    throw err;
  }
}

// ── Equipment ─────────────────────────────────────────────────────────────────

async function syncEquipment() {
  let synced = 0, failed = 0;

  try {
    const api = stApi();
    const items = await api.getAll('/equipmentsystems/v2/installed-equipment');

    for (const item of items) {
      try {
        await query(
          `INSERT INTO equipment
             (st_equipment_id, st_customer_id, st_job_id, name, manufacturer, model,
              serial_number, status, installed_at, warranty_start, warranty_expiry,
              last_service_date, last_service_job, raw_st_data, st_last_synced)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
           ON CONFLICT (st_equipment_id) DO UPDATE
             SET st_customer_id    = EXCLUDED.st_customer_id,
                 name              = EXCLUDED.name,
                 manufacturer      = EXCLUDED.manufacturer,
                 model             = EXCLUDED.model,
                 serial_number     = EXCLUDED.serial_number,
                 installed_at      = EXCLUDED.installed_at,
                 warranty_start    = EXCLUDED.warranty_start,
                 warranty_expiry   = EXCLUDED.warranty_expiry,
                 last_service_date = EXCLUDED.last_service_date,
                 last_service_job  = EXCLUDED.last_service_job,
                 raw_st_data       = EXCLUDED.raw_st_data,
                 st_last_synced    = NOW(),
                 updated_at        = NOW()`,
          [
            String(item.id),
            item.customerId ? String(item.customerId) : null,
            null,  // ST installed-equipment doesn't include job_id; leave null
            item.name || 'Unnamed Equipment',
            item.manufacturer || null,
            item.model || null,
            item.serialNumber || null,
            item.installedOn ? 'installed' : 'in_stock',
            item.installedOn || null,
            item.manufacturerWarrantyStart || null,
            item.manufacturerWarrantyEnd || null,
            null,  // last_service_date — not in installed-equipment response
            null,  // last_service_job — not in installed-equipment response
            JSON.stringify(item),
          ],
        );
        synced++;
      } catch (e) {
        console.warn(`Equipment ${item.id} failed:`, e.message);
        failed++;
      }
    }

    await writeSyncLog('equipment', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('equipment', 'failed', synced, failed, err.message);
    throw err;
  }
}

// ── Technicians → users ───────────────────────────────────────────────────────

async function syncTechnicians() {
  let synced = 0, failed = 0;

  try {
    const api = stApi();
    const techs = await api.getAll('/settings/v2/technicians');

    for (const tech of techs) {
      try {
        // ST returns full `name` — split into first/last (required NOT NULL in users table)
        const parts = (tech.name || '').trim().split(/\s+/);
        const first_name = parts[0] || 'Unknown';
        const last_name = parts.slice(1).join(' ') || '(ST)';
        // Email is NOT NULL and UNIQUE in users — fall back to synthetic if ST has none
        const email = (tech.email || `st-tech-${tech.id}@christmasair.local`).toLowerCase();

        await query(
          `INSERT INTO users (st_technician_id, email, first_name, last_name, phone, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'technician', $6, NOW(), NOW())
           ON CONFLICT (st_technician_id) DO UPDATE SET
             email      = EXCLUDED.email,
             first_name = EXCLUDED.first_name,
             last_name  = EXCLUDED.last_name,
             phone      = COALESCE(EXCLUDED.phone, users.phone),
             is_active  = EXCLUDED.is_active,
             updated_at = NOW()`,
          [String(tech.id), email, first_name, last_name, tech.phoneNumber || null, tech.active !== false],
        );
        synced++;
      } catch (e) {
        console.warn(`Tech ${tech.id} failed:`, e.message);
        failed++;
      }
    }

    await writeSyncLog('technicians', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('technicians', 'failed', synced, failed, err.message);
    throw err;
  }
}

// ── Vehicles → trucks ─────────────────────────────────────────────────────────

async function syncVehicles() {
  // ServiceTitan does not expose a public vehicles/fleet endpoint for this tenant.
  // Trucks are managed manually in the trucks table. This sync is a graceful no-op.
  const note = 'ST does not expose a public vehicles endpoint; trucks are managed manually.';
  await writeSyncLog('trucks', 'skipped', 0, 0, note);
  return { synced: 0, failed: 0, skipped: true, reason: note };
}

/**
 * syncJobs — pull active jobs from ServiceTitan and upsert into st_jobs.
 * Stub: extends syncAll pattern when ST jobs API endpoint is confirmed.
 */
async function syncJobs() {
  const { query } = require('../config/db');
  let synced = 0;
  const failed = 0;
  try {
    const token = await getAccessToken();
    const { data } = await axios.get(
      `${env.st.baseUrl}/jpm/v2/tenant/${env.st.tenantId}/jobs`,
      {
        headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': env.st.appKey },
        params: { active: true, pageSize: 200 },
      },
    );
    const jobs = data.data ?? [];
    for (const j of jobs) {
      await query(
        `INSERT INTO st_jobs (st_job_id, job_number, customer_name, customer_address, status, job_type, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (st_job_id) DO UPDATE
           SET job_number = EXCLUDED.job_number,
               customer_name = EXCLUDED.customer_name,
               customer_address = EXCLUDED.customer_address,
               status = EXCLUDED.status,
               job_type = EXCLUDED.job_type,
               scheduled_at = EXCLUDED.scheduled_at,
               updated_at = NOW()`,
        [
          String(j.id),
          j.jobNumber ?? String(j.id),
          j.customer?.name ?? null,
          j.location?.address ?? null,
          j.status?.toLowerCase().replace(' ', '_') ?? 'scheduled',
          j.jobType?.name ?? null,
          j.scheduledOn ?? null,
        ],
      );
      synced++;
    }
    await writeSyncLog('jobs', 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('jobs', 'failed', synced, failed, err.message);
    throw err;
  }
}

async function syncAll() {
  const results = await Promise.allSettled([
    syncPricebook(),
    syncEquipment(),
    syncTechnicians(),
    syncVehicles(),
    syncJobs(),
  ]);
  return results.map((r, i) => ({
    step: ['pricebook', 'equipment', 'technicians', 'vehicles', 'jobs'][i],
    status: r.status,
    value: r.value,
    reason: r.reason?.message,
  }));
}

module.exports = { syncPricebook, syncEquipment, syncTechnicians, syncVehicles, syncJobs, syncAll };
