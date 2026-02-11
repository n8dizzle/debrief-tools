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
// AP PAYMENTS TYPES
// ============================================

export type APContractorTrade = 'hvac' | 'plumbing' | 'both';

export interface APContractor {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  trade: APContractorTrade;
  payment_method: string | null;
  payment_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface APContractorRate {
  id: string;
  contractor_id: string;
  trade: 'hvac' | 'plumbing';
  job_type_name: string;
  rate_amount: number;
  rate_type: 'flat' | 'percentage';
  created_at: string;
  updated_at: string;
}

export type APAssignmentType = 'unassigned' | 'in_house' | 'contractor';
export type APPaymentStatus = 'none' | 'requested' | 'approved' | 'paid';

export interface APInstallJob {
  id: string;
  st_job_id: number;
  job_number: string;
  job_status: string | null;
  trade: 'hvac' | 'plumbing';
  job_type_name: string | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  job_address: string | null;
  st_customer_id: number | null;
  st_location_id: number | null;
  scheduled_date: string | null;
  completed_date: string | null;
  job_total: number | null;
  summary: string | null;
  assignment_type: APAssignmentType;
  contractor_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  payment_amount: number | null;
  payment_status: APPaymentStatus;
  payment_requested_at: string | null;
  payment_approved_at: string | null;
  payment_approved_by: string | null;
  payment_paid_at: string | null;
  payment_expected_date: string | null;
  payment_method: string | null;
  payment_notes: string | null;
  is_ignored: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  contractor?: APContractor;
}

export interface APActivityLog {
  id: string;
  job_id: string | null;
  contractor_id: string | null;
  action: string;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
  // Joined data
  performer?: { name: string; email: string } | null;
}

export interface APSyncLog {
  id: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  jobs_processed: number;
  jobs_created: number;
  jobs_updated: number;
  errors: string | null;
  status: string | null;
}

export interface APMonthlyTrend {
  month: string;        // "2026-01"
  label: string;        // "Jan 26"
  job_total: number;    // sum of job_total for contractor jobs
  contractor_pay: number; // sum of payment_amount for contractor jobs
  contractor_pct: number; // (contractor_pay / job_total) * 100
}

export interface APDashboardStats {
  total_jobs: number;
  unassigned_jobs: number;
  contractor_jobs: number;
  in_house_jobs: number;
  payments_requested: number;
  payments_approved: number;
  payments_paid: number;
  total_outstanding: number;
  total_paid: number;
  contractor_pct: number;
  monthly_trend: APMonthlyTrend[];
  last_sync: string | null;
}

export interface APContractorRateHistory {
  id: string;
  contractor_id: string;
  rate_id: string | null;
  trade: string;
  job_type_name: string;
  old_amount: number | null;
  new_amount: number;
  change_type: 'created' | 'updated';
  changed_by: string | null;
  effective_date: string;
  created_at: string;
}

export interface APContractorWithStats extends APContractor {
  total_jobs: number;
  total_paid: number;
  total_outstanding: number;
  rates: APContractorRate[];
}
