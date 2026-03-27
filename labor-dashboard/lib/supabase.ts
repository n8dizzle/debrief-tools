import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Server-side Supabase client (uses service role key, bypasses RLS)
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey);
  }
  return createClient(url, anonKey);
}

// ============================================
// LABOR DASHBOARD TYPES
// ============================================

export interface LaborEmployee {
  id: string;
  st_employee_id: number;
  name: string;
  employee_type: string; // 'Technician' | 'Sales' | 'Office' etc.
  trade: 'hvac' | 'plumbing' | 'both' | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaborGrossPayItem {
  id: string;
  st_pay_item_id: number;
  employee_id: number;
  employee_name: string | null;
  employee_type: string | null;
  gross_pay_item_type: string; // 'TimesheetTime' | 'InvoiceRelatedBonus' etc.
  date: string;
  started_on: string | null;
  ended_on: string | null;
  amount: number;
  paid_duration_hours: number;
  paid_time_type: string | null; // 'Regular' | 'Overtime'
  activity: string | null; // 'Working', 'Driving', 'Idle', 'PTO', '10% Sales', etc.
  job_id: number | null;
  job_number: string | null;
  invoice_id: number | null;
  customer_name: string | null;
  job_type_name: string | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  trade: 'hvac' | 'plumbing' | null;
  synced_at: string;
  created_at: string;
}

export interface LaborPayrollAdjustment {
  id: string;
  st_adjustment_id: number;
  employee_id: number;
  employee_name: string | null;
  adjustment_type: string | null;
  amount: number;
  date: string;
  memo: string | null;
  synced_at: string;
  created_at: string;
}

export interface LaborSyncLog {
  id: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  items_processed: number;
  items_created: number;
  items_updated: number;
  errors: string | null;
  status: string | null;
}
