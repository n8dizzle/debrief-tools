import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes, never expose to client
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Fall back to anon key if service role not set
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================
// PORTAL TYPES (shared with internal-portal)
// ============================================

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string | null;
  department_id: string | null;
  role: 'employee' | 'manager' | 'owner';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string | null;
  // Joined data
  department?: Department;
}

// ============================================
// HUDDLE DASHBOARD TYPES
// ============================================

export type HuddleKPIStatus = 'pending' | 'met' | 'close' | 'missed';
export type HuddleDataSource = 'servicetitan' | 'google_sheets' | 'calculated' | 'manual';
export type HuddleKPIFormat = 'number' | 'currency' | 'percent' | 'boolean' | 'text' | 'time';
export type HuddleTargetType = 'daily' | 'weekly' | 'monthly';

export interface HuddleDepartment {
  id: string;
  name: string;
  slug: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HuddleKPI {
  id: string;
  department_id: string;
  name: string;
  slug: string;
  description: string | null;
  unit: string;
  format: HuddleKPIFormat;
  data_source: HuddleDataSource;
  source_config: Record<string, unknown>;
  higher_is_better: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  department?: HuddleDepartment;
}

export interface HuddleTarget {
  id: string;
  kpi_id: string;
  target_type: HuddleTargetType;
  target_value: number;
  effective_date: string;
  source: string;
  sheet_cell: string | null;
  created_at: string;
  updated_at: string;
}

export interface HuddleSnapshot {
  id: string;
  kpi_id: string;
  snapshot_date: string;
  actual_value: number | null;
  percent_to_goal: number | null;
  status: HuddleKPIStatus;
  data_source: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HuddleNote {
  id: string;
  kpi_id: string;
  note_date: string;
  note_text: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  updated_by_user?: PortalUser;
}

export interface HuddleSheetsConfig {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  sync_type: 'targets' | 'actuals';
  cell_mappings: Record<string, string>;
  last_synced_at: string | null;
  sync_frequency_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HuddlePermission {
  id: string;
  user_id: string;
  department_id: string;
  can_view: boolean;
  can_edit_notes: boolean;
  can_edit_actuals: boolean;
  created_at: string;
}

// ============================================
// HUDDLE API RESPONSE TYPES
// ============================================

export interface HuddleKPIWithData extends HuddleKPI {
  target: number | null;
  actual: number | null;
  percent_to_goal: number | null;
  status: HuddleKPIStatus;
  note: string | null;
}

export interface HuddleDepartmentWithKPIs extends HuddleDepartment {
  kpis: HuddleKPIWithData[];
}

export interface HuddlePacingData {
  todayRevenue: number;
  dailyTarget: number;
  wtdRevenue: number;
  weeklyTarget: number;
  mtdRevenue: number;
  monthlyTarget: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
}

export interface HuddleDashboardResponse {
  date: string;
  departments: HuddleDepartmentWithKPIs[];
  last_updated: string;
  pacing?: HuddlePacingData;
}

export interface HuddleHistoricalData {
  kpi_id: string;
  date: string;
  actual: number | null;
  target: number | null;
  percent_to_goal: number | null;
  status: HuddleKPIStatus;
  note: string | null;
}

export interface HuddleHistoricalResponse {
  start_date: string;
  end_date: string;
  dates: string[];
  departments: {
    id: string;
    name: string;
    slug: string;
    kpis: {
      id: string;
      name: string;
      slug: string;
      format: HuddleKPIFormat;
      unit: string;
      values: HuddleHistoricalData[];
    }[];
  }[];
}

// ============================================
// TREND CHART TYPES
// ============================================

export interface MonthlyTrendData {
  month: string;        // "2025-08" format
  label: string;        // "AUG" display format
  hvacRevenue: number;
  plumbingRevenue: number;
  totalRevenue: number;
  goal: number;
}
