import 'server-only';
import { query } from '../db';

export type SettingsValue = string | number | boolean | null;

export interface AppSettings {
  company: { name: string; email: string; phone: string; address: string };
  servicetitan: { tenant_id: string; sync_frequency: string; auto_sync_enabled: boolean; last_sync_at: string | null };
  notifications: { email_alerts_enabled: boolean; low_stock_threshold: number; manager_email: string };
  inventory: { default_department: string; reorder_lead_days: number; auto_lock_batches: boolean; auto_lock_hour: number; weekly_po_enabled: boolean; weekly_po_day: string };
  [section: string]: Record<string, SettingsValue>;
}

const DEFAULTS: AppSettings = {
  company: {
    name: 'Davis Plumbing & AC',
    email: 'ray@christmasair.com',
    phone: '972-555-0100',
    address: '1200 Lakeside Pkwy, Lewisville TX 75057',
  },
  servicetitan: {
    tenant_id: process.env.ST_TENANT_ID ?? '',
    sync_frequency: 'every_4_hours',
    auto_sync_enabled: false,
    last_sync_at: null,
  },
  notifications: {
    email_alerts_enabled: true,
    low_stock_threshold: 1.0,
    manager_email: process.env.MANAGER_NOTIFY_EMAIL ?? '',
  },
  inventory: {
    default_department: 'plumbing',
    reorder_lead_days: 3,
    auto_lock_batches: true,
    auto_lock_hour: 6,
    weekly_po_enabled: true,
    weekly_po_day: 'monday',
  },
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const { rows } = await query<{ section: string; key: string; value: string }>(
      `SELECT section, key, value FROM app_settings ORDER BY section, key`,
    );
    const result = JSON.parse(JSON.stringify(DEFAULTS)) as AppSettings;
    for (const row of rows) {
      if (!result[row.section]) result[row.section] = {};
      try {
        result[row.section][row.key] = JSON.parse(row.value) as SettingsValue;
      } catch {
        result[row.section][row.key] = row.value;
      }
    }
    return result;
  } catch {
    return DEFAULTS;
  }
}

export async function patchSettings(section: string, data: Record<string, unknown>): Promise<AppSettings> {
  for (const [key, value] of Object.entries(data)) {
    await query(
      `INSERT INTO app_settings (section, key, value)
         VALUES ($1, $2, $3::text)
       ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [section, key, JSON.stringify(value)],
    );
  }
  return loadSettings();
}
