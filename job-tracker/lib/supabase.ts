import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key, respects RLS)
// Only create if URL is configured
let _supabaseClient: SupabaseClient | null = null;

export const supabase = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or anon key not configured');
    return null as unknown as SupabaseClient;
  }
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabaseClient;
})();

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes, never expose to client
let _serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (_serverClient) {
    return _serverClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured');
    }
    // Fall back to anon key if service role not set
    _serverClient = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    _serverClient = createClient(supabaseUrl, serviceRoleKey);
  }

  return _serverClient;
}

// ============================================
// JOB TRACKER TYPES
// ============================================

export type TrackerStatus = 'active' | 'completed' | 'cancelled' | 'on_hold';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type Trade = 'hvac' | 'plumbing';
export type JobType = 'install' | 'repair' | 'maintenance' | 'service';
export type NotificationType = 'sms' | 'email';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface TrackerTemplate {
  id: string;
  name: string;
  description: string | null;
  trade: Trade;
  job_type: JobType;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  milestones?: TrackerTemplateMilestone[];
}

export interface TrackerTemplateMilestone {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_optional: boolean;
  auto_complete_on_st_status: string | null;
  created_at: string;
}

export interface JobTracker {
  id: string;
  tracking_code: string;
  st_job_id: number | null;
  st_customer_id: number | null;
  job_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  trade: Trade;
  job_type: JobType;
  job_description: string | null;
  template_id: string | null;
  status: TrackerStatus;
  current_milestone_id: string | null;
  progress_percent: number;
  notify_sms: boolean;
  notify_email: boolean;
  notification_phone: string | null;
  notification_email: string | null;
  created_by: string | null;
  assigned_to: string | null;
  auto_created: boolean;
  scheduled_date: string | null;
  estimated_completion: string | null;
  actual_completion: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  milestones?: TrackerMilestone[];
  template?: TrackerTemplate;
  creator?: PortalUser;
  assignee?: PortalUser;
}

export interface TrackerMilestone {
  id: string;
  tracker_id: string;
  template_milestone_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  status: MilestoneStatus;
  completed_at: string | null;
  completed_by: string | null;
  staff_notes: string | null;
  customer_notes: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  is_optional: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  completer?: PortalUser;
}

export interface TrackerActivity {
  id: string;
  tracker_id: string;
  activity_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  performed_by_system: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined data
  performer?: PortalUser;
}

export interface TrackerNotification {
  id: string;
  tracker_id: string;
  milestone_id: string | null;
  notification_type: NotificationType;
  recipient: string;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  external_id: string | null;
  created_at: string;
}

// ============================================
// PORTAL TYPES (shared with internal-portal)
// ============================================

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
}

// ============================================
// PUBLIC TRACKER VIEW TYPE
// ============================================

export interface PublicTrackerView {
  id: string;
  tracking_code: string;
  customer_name: string;
  job_address: string | null;
  trade: Trade;
  job_type: JobType;
  job_description: string | null;
  status: TrackerStatus;
  progress_percent: number;
  scheduled_date: string | null;
  estimated_completion: string | null;
  actual_completion: string | null;
  notify_sms: boolean;
  notify_email: boolean;
  notification_phone: string | null;
  notification_email: string | null;
  milestones: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    sort_order: number;
    status: MilestoneStatus;
    completed_at: string | null;
    customer_notes: string | null;
  }[];
}
