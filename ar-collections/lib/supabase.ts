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
// AR COLLECTIONS TYPES
// ============================================

export type ARInvoiceStatus = 'open' | 'partial' | 'paid' | 'written_off';
export type ARAgingBucket = 'current' | '30' | '60' | '90+';
export type ARCustomerType = 'residential' | 'commercial';
export type ARJobType = 'install' | 'service';
export type ARControlBucket = 'ar_collectible' | 'ar_not_in_our_control';
export type ARJobStatus =
  | 'qc_booked'
  | 'qc_completed'
  | 'job_not_done'
  | 'need_clarification'
  | 'construction'
  | 'tech_question'
  | 'emailed_customer'
  | 'called_customer'
  | 'payment_promised'
  | 'financing_pending'
  | 'other';

export type ARPaymentType = 'cash' | 'check' | 'card' | 'financing';
export type ARFinancingType =
  | 'synchrony'
  | 'wells_fargo'
  | 'wisetack'
  | 'ally'
  | 'in_house'
  | 'other';

export type ARFinancingStatus =
  | 'submitted'
  | 'needs_signature'
  | 'approved'
  | 'funded'
  | 'paid';

export type ARCollectionPriority = 'low' | 'normal' | 'high' | 'critical';
export type ARCollectionStatus = 'none' | 'contacted' | 'promised' | 'disputed' | 'escalated';

export type ARTaskType = 'call' | 'email' | 'letter' | 'escalation';
export type ARTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ARTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ARNoteType = 'call' | 'text' | 'email' | 'task' | 'status_change' | 'payment_promise';
export type ARContactResult = 'reached' | 'voicemail' | 'no_answer' | 'left_message';

export type ARPaymentPlanStatus = 'active' | 'completed' | 'defaulted';
export type ARPaymentMonthStatus = 'pending' | 'paid' | 'late' | 'missed';

export type ARTemplateType = 'reminder' | 'past_due' | 'final_notice' | 'payment_plan';
export type ARSMSStatus = 'sent' | 'delivered' | 'failed';

// ============================================
// AR DATABASE TYPES
// ============================================

export interface ARInvoice {
  id: string;
  st_invoice_id: number;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  invoice_total: number;
  balance: number;
  amount_paid: number;
  invoice_date: string;
  due_date: string;
  last_payment_date: string | null;
  days_outstanding: number;
  aging_bucket: ARAgingBucket;
  status: ARInvoiceStatus;
  business_unit_id: number | null;
  business_unit_name: string | null;
  job_type: ARJobType;
  customer_type: ARCustomerType;
  st_job_id: number | null;
  job_number: string | null;
  technician_name: string | null;
  has_inhouse_financing: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface ARInvoiceTracking {
  id: string;
  invoice_id: string;
  owner_id: string | null;
  job_status: ARJobStatus | null;
  control_bucket: ARControlBucket;
  // QC Tracking
  qc_scheduled_date: string | null;
  qc_completed_date: string | null;
  qc_technician: string | null;
  // Payment tracking
  payment_type: ARPaymentType | null;
  financing_type: ARFinancingType | null;
  financing_status: ARFinancingStatus | null;
  invoice_verified: boolean;
  // In-house financing plan settings
  financing_monthly_amount: number | null;
  financing_due_day: number | null;
  financing_start_date: string | null;
  financing_notes: string | null;
  // Collection workflow
  day1_text_sent: boolean;
  day1_text_date: string | null;
  day2_call_made: boolean;
  day2_call_date: string | null;
  day3_etc: boolean;
  day3_etc_date: string | null;
  day7_etc: boolean;
  day7_etc_date: string | null;
  certified_letter_sent: boolean;
  certified_letter_date: string | null;
  closed: boolean;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: PortalUser;
  invoice?: ARInvoice;
}

export interface ARCustomer {
  id: string;
  st_customer_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  total_outstanding: number;
  oldest_invoice_date: string | null;
  invoice_count: number;
  collection_priority: ARCollectionPriority;
  collection_status: ARCollectionStatus;
  next_followup_date: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ARPayment {
  id: string;
  st_payment_id: number;
  invoice_id: string;
  customer_id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  created_at: string;
}

export interface ARCollectionTask {
  id: string;
  customer_id: string | null;
  invoice_id: string | null;
  task_type: ARTaskType;
  title: string;
  description: string | null;
  status: ARTaskStatus;
  priority: ARTaskPriority;
  assigned_to: string | null;
  due_date: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  followup_required: boolean;
  followup_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: ARCustomer;
  invoice?: ARInvoice;
  assignee?: PortalUser;
}

export interface ARCollectionNote {
  id: string;
  invoice_id: string | null;
  customer_id: string | null;
  note_date: string;
  author_initials: string;
  content: string;
  note_type: ARNoteType;
  contact_result: ARContactResult | null;
  spoke_with: string | null;
  promised_amount: number | null;
  promised_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ARSyncLog {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  errors: string | null;
  status: 'running' | 'completed' | 'failed';
}

export interface ARAgingSnapshot {
  id: string;
  snapshot_date: string;
  total_outstanding: number;
  current_bucket: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90_plus: number;
  install_total: number;
  service_total: number;
  ar_collectible: number;
  ar_not_in_control: number;
  created_at: string;
}

export interface ARPaymentPlan {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  owner_id: string | null;
  total_balance: number;
  monthly_payment_amount: number;
  payment_due_day: number;
  start_date: string;
  estimated_end_date: string | null;
  status: ARPaymentPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: ARCustomer;
  invoice?: ARInvoice;
  owner?: PortalUser;
}

export interface ARPaymentPlanMonth {
  id: string;
  plan_id: string;
  year: number;
  month: number;
  payment_due: number;
  payment_received: number;
  paid_date: string | null;
  amount_paid: number | null;
  status: ARPaymentMonthStatus;
  created_at: string;
  updated_at: string;
}

export interface AREmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: ARTemplateType;
  days_overdue_trigger: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AREmailSent {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  template_id: string | null;
  sent_at: string;
  sent_by: string;
  recipient_email: string;
  subject: string;
  body_snapshot: string;
}

export interface ARSMSTemplate {
  id: string;
  name: string;
  body: string;
  template_type: ARTemplateType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ARSMSSent {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  template_id: string | null;
  sent_at: string;
  sent_by: string;
  recipient_phone: string;
  message: string;
  status: ARSMSStatus;
}

// ============================================
// AR API RESPONSE TYPES
// ============================================

export interface ARDashboardStats {
  total_outstanding: number;
  ar_collectible: number;
  ar_not_in_control: number;
  avg_dso: number;
  aging_buckets: {
    current: number;
    bucket_30: number;
    bucket_60: number;
    bucket_90_plus: number;
  };
  install_total: number;
  service_total: number;
  residential_total: number;
  commercial_total: number;
  top_balances: (ARInvoice & { tracking?: ARInvoiceTracking })[];
  recent_activity: ARCollectionNote[];
}

export interface ARInvoiceWithTracking extends ARInvoice {
  tracking: ARInvoiceTracking | null;
  notes: ARCollectionNote[];
  payments: ARPayment[];
}

export interface ARCustomerWithDetails extends ARCustomer {
  invoices: ARInvoice[];
  payments: ARPayment[];
  tasks: ARCollectionTask[];
  notes: ARCollectionNote[];
}

export interface ARSyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  data_completeness: number;
  missing_dates: string[];
}

// ============================================
// IN-HOUSE FINANCING TYPES
// ============================================

export interface FinancingInvoice {
  id: string;
  st_invoice_id: number;
  invoice_number: string;
  customer_id: string | null;
  st_customer_id: number | null;
  customer_name: string;
  invoice_total: number;
  balance: number;
  amount_paid: number;
  invoice_date: string;
  // Financing settings from tracking
  financing_monthly_amount: number | null;
  financing_due_day: number | null;
  financing_start_date: string | null;
  financing_notes: string | null;
  // Calculated fields
  payments_made: number;
  last_payment_date: string | null;
  next_due_date: string | null;
  projected_payoff_date: string | null;
  payments_remaining: number;
  // Nested data
  payments: ARPayment[];
}

export interface UpcomingPayment {
  due_date: string;
  amount: number;
  is_overdue: boolean;
  is_next: boolean;
}

export interface PaymentSchedule {
  upcoming: UpcomingPayment[];
  projected_payoff_date: string | null;
  payments_remaining: number;
  total_remaining: number;
}

// ============================================
// AR SYNC HELPER FUNCTIONS
// ============================================

/**
 * Get the last successful sync date from ar_sync_log
 * Returns null if no successful sync has ever run
 */
export async function getLastSuccessfulSyncDate(): Promise<string | null> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ar_sync_log')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.completed_at;
}

/**
 * Get all open invoice ST IDs for balance re-checking during incremental sync
 * Only returns invoices with real ST IDs (> 0)
 */
export async function getOpenInvoiceStIds(): Promise<number[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ar_invoices')
    .select('st_invoice_id')
    .gt('balance', 0)
    .gt('st_invoice_id', 0);

  if (error || !data) {
    return [];
  }

  return data
    .map((inv) => inv.st_invoice_id)
    .filter((id): id is number => id !== null && id > 0);
}

/**
 * Check if we have any real invoices (not fake Report 249 data)
 */
export async function hasRealInvoices(): Promise<boolean> {
  const supabase = getServerSupabase();

  const { count, error } = await supabase
    .from('ar_invoices')
    .select('*', { count: 'exact', head: true })
    .gt('st_invoice_id', 0);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}
