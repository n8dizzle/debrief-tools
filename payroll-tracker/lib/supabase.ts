import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes, never expose to client
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
// PAYROLL TRACKER TYPES
// ============================================

export interface PREmployee {
  id: string;
  st_employee_id: number;
  name: string;
  trade: 'hvac' | 'plumbing' | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PRPayrollPeriod {
  id: string;
  st_payroll_id: number;
  start_date: string;
  end_date: string;
  check_date: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export type PRPayType = 'Regular' | 'Overtime' | 'PerformancePay' | 'Other';

export interface PRGrossPayItem {
  id: string;
  st_pay_item_id: number;
  employee_id: string;
  st_employee_id: number;
  payroll_period_id: string | null;
  st_payroll_id: number | null;
  st_job_id: number | null;
  job_number: string | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  pay_type: PRPayType;
  hours: number;
  amount: number;
  activity: string | null;
  date: string;
  created_at: string;
  // Joined
  employee?: PREmployee;
}

export interface PRJobTimesheet {
  id: string;
  st_timesheet_id: number;
  employee_id: string;
  st_employee_id: number;
  st_job_id: number;
  job_number: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_hours: number | null;
  date: string;
  created_at: string;
  // Joined
  employee?: PREmployee;
}

export interface PRNonJobTimesheet {
  id: string;
  st_timesheet_id: number;
  employee_id: string;
  st_employee_id: number;
  timesheet_code_id: number | null;
  timesheet_code_name: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_hours: number | null;
  date: string;
  created_at: string;
  // Joined
  employee?: PREmployee;
}

export interface PRPayrollAdjustment {
  id: string;
  st_adjustment_id: number;
  employee_id: string;
  st_employee_id: number;
  payroll_period_id: string | null;
  st_payroll_id: number | null;
  adjustment_type: string | null;
  amount: number;
  memo: string | null;
  date: string | null;
  created_at: string;
  // Joined
  employee?: PREmployee;
}

export interface PRJobSplit {
  id: string;
  st_split_id: number;
  st_job_id: number;
  job_number: string | null;
  employee_id: string;
  st_employee_id: number;
  split_percentage: number | null;
  split_amount: number | null;
  date: string | null;
  created_at: string;
  // Joined
  employee?: PREmployee;
}

export interface PRSyncLog {
  id: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  errors: string | null;
  status: string | null;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface PRDashboardStats {
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_pay: number;
  performance_pay: number;
  non_job_hours: number;
  avg_hourly_rate: number;
  employee_count: number;
  daily_hours: PRDailyHours[];
  top_earners: PRTopEarner[];
  last_sync: string | null;
}

export interface PRDailyHours {
  date: string;
  regular: number;
  overtime: number;
  non_job: number;
}

export interface PRTopEarner {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  total_pay: number;
  performance_pay: number;
}

export interface PREmployeeSummary {
  id: string;
  name: string;
  trade: string | null;
  business_unit_name: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  performance_pay: number;
  total_pay: number;
}
