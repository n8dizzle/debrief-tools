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
// MEMBERSHIP MANAGER TYPES
// ============================================

export interface MMMembershipType {
  id: string;
  st_type_id: number;
  name: string;
  status: string | null;
  billing_frequency: string | null;
  duration_billing_periods: number | null;
  service_count: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MMMembership {
  id: string;
  st_membership_id: number;
  st_membership_type_id: number | null;
  membership_type_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  next_scheduled_billing_date: string | null;
  billing_frequency: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  st_customer_id: number | null;
  st_location_id: number | null;
  location_name: string | null;
  total_visits_expected: number;
  total_visits_completed: number;
  total_visits_scheduled: number;
  next_visit_due_date: string | null;
  days_until_expiry: number | null;
  sold_on: string | null;
  sold_by_id: number | null;
  sold_by_name: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MMRecurringService {
  id: string;
  st_service_id: number;
  st_membership_id: number;
  name: string;
  status: string | null;
  recurrence_type: string | null;
  recurrence_interval: number;
  duration_type: string | null;
  next_service_date: string | null;
  st_location_id: number | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MMRecurringServiceEvent {
  id: string;
  st_event_id: number;
  st_service_id: number | null;
  st_membership_id: number | null;
  st_job_id: number | null;
  name: string | null;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  st_location_id: number | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MMStaffNote {
  id: string;
  membership_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface MMSyncLog {
  id: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  memberships_processed: number;
  memberships_created: number;
  memberships_updated: number;
  services_processed: number;
  events_processed: number;
  errors: string | null;
  status: string | null;
}

export interface MMDashboardStats {
  active_memberships: number;
  overdue_visits: number;
  expiring_30_days: number;
  fulfillment_rate: number;
  last_sync: string | null;
}
