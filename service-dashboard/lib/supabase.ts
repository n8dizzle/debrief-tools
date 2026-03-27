import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================
// SERVICE DASHBOARD TYPES
// ============================================

export type SDTrade = 'hvac' | 'plumbing';

export interface SDTechnician {
  id: string;
  st_technician_id: number;
  name: string;
  is_active: boolean;
  business_unit_id: number | null;
  business_unit_name: string | null;
  trade: SDTrade;
  team_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SDCompletedJob {
  id: string;
  st_job_id: number;
  st_technician_id: number;
  job_total: number;
  completed_date: string;
  business_unit_name: string | null;
  trade: SDTrade;
  customer_name: string | null;
  estimate_count: number;
  created_at: string;
}

export interface SDEstimate {
  id: string;
  st_estimate_id: number;
  sold_by_id: number;
  subtotal: number;
  sold_on: string;
  status: string | null;
  created_at: string;
}

export interface SDMembershipSold {
  id: string;
  st_membership_id: number;
  sold_by_id: number;
  membership_type_name: string | null;
  sold_on: string;
  created_at: string;
}

export interface SDSyncLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  technicians_synced: number;
  jobs_synced: number;
  estimates_synced: number;
  memberships_synced: number;
  errors: string[] | null;
}

export interface SDScoringConfig {
  id: string;
  weights: Record<string, number>;
  updated_at: string;
  updated_by: string | null;
}

// ============================================
// ATTENDANCE TYPES
// ============================================

export type AttendanceInfractionType = string;

export interface InfractionTypeConfig {
  key: string;
  label: string;
  points: number;
}

export interface AttendanceThreshold {
  points: number;
  label: string;
}

export interface AttendanceConfig {
  id: string;
  infraction_types: InfractionTypeConfig[];
  thresholds: AttendanceThreshold[];
  rolling_months: number;
  updated_at: string;
  updated_by: string | null;
}

// Default config used as fallback when DB config isn't loaded yet
export const DEFAULT_INFRACTION_TYPES: InfractionTypeConfig[] = [
  { key: 'excused_absence', label: 'Excused Absence', points: 0 },
  { key: 'tardy', label: 'Tardy (≤30 min)', points: 0.5 },
  { key: 'unexcused_absence', label: 'Unexcused Absence', points: 1 },
  { key: 'late', label: 'Late (31 min – 2 hrs)', points: 1 },
  { key: 'excessive_idle', label: 'Excessive Idle Time', points: 1 },
  { key: 'early_departure', label: 'Early Departure (>30 min)', points: 1 },
  { key: 'late_reported_absent', label: 'Late Reported Absent (<1 hr notice)', points: 2 },
  { key: 'ncns', label: 'No Call / No Show', points: 3 },
  { key: 'on_call_violation', label: 'On-Call Procedure Violation', points: 3 },
  { key: 'perfect_month', label: 'Perfect Month', points: -1 },
];

export const DEFAULT_THRESHOLDS: AttendanceThreshold[] = [
  { points: 3, label: 'Verbal Warning' },
  { points: 6, label: 'Written Warning' },
  { points: 9, label: 'Final Warning' },
  { points: 12, label: 'Termination' },
];

// Legacy compat: build INFRACTION_CONFIG from default types
export const INFRACTION_CONFIG: Record<string, { label: string; points: number }> = Object.fromEntries(
  DEFAULT_INFRACTION_TYPES.map(t => [t.key, { label: t.label, points: t.points }])
);

export interface SDAttendanceRecord {
  id: string;
  technician_id: string;
  date: string;
  type: AttendanceInfractionType;
  points: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

// ============================================
// LEADERBOARD TYPES
// ============================================

export interface LeaderboardEntry {
  technician_id: string;
  st_technician_id: number;
  name: string;
  trade: SDTrade;
  gross_sales: number;
  tgls: number;
  options_per_opportunity: number;
  reviews: number;
  memberships_sold: number;
  attendance_points: number;
  score: number;
  rank: number;
  score_breakdown: {
    gross_sales_score: number;
    tgls_score: number;
    options_per_opportunity_score: number;
    reviews_score: number;
    memberships_score: number;
    attendance_score: number;
  };
}
