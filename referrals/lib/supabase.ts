import { createClient } from "@supabase/supabase-js";

/**
 * All Supabase access goes through this helper. The bare `createClient`
 * call is intentionally NOT made at module load — Next.js page-data
 * collection imports server modules even when env vars aren't present
 * (e.g. local builds without .env.local), and createClient throws on
 * empty url/key. Instantiating per-call is cheap.
 */
export function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey);
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
  role: "employee" | "manager" | "owner";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string | null;
  department?: Department;
}

// ============================================
// REFERRALS DOMAIN TYPES
// ============================================

export type ServiceCategory =
  | "SERVICE_CALL"
  | "MAINTENANCE"
  | "REPLACEMENT"
  | "COMMERCIAL";

export type RewardMode = "FLAT" | "PERCENTAGE_OF_INVOICE" | "TIERED_BY_INVOICE";

export type DiscountType = "FLAT_OFF" | "PERCENT_OFF" | "FREE_MONTH" | "CUSTOM";

export type CharityMatchMode = "PERCENTAGE" | "FLAT" | "DISABLED";

export type RewardType =
  | "VISA_GIFT_CARD"
  | "AMAZON_GIFT_CARD"
  | "ACCOUNT_CREDIT"
  | "CHARITY_DONATION";

export type CharityFulfillment =
  | "TREMENDOUS"
  | "DIRECT_PAYMENT"
  | "POOLED_QUARTERLY";

export type DonationStatus =
  | "PENDING"
  | "APPROVED"
  | "ISSUED"
  | "CONFIRMED"
  | "FAILED";

export type ReferralStatus =
  | "SUBMITTED"
  | "BOOKED"
  | "COMPLETED"
  | "REWARD_ISSUED"
  | "EXPIRED"
  | "INELIGIBLE";

export type RewardStatus =
  | "PENDING"
  | "APPROVED"
  | "ISSUED"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export type ChangeRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "APPLIED";

export interface InvoiceBracket {
  minInvoice: number;
  maxInvoice: number | null;
  rewardAmount: number;
}

export interface RewardConfig {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  effective_from: string;
  effective_until: string | null;
  traffic_allocation: number;
  experiment_group: string | null;
  created_at: string;
  updated_at: string;
  created_by_admin_id: string | null;
}

export interface RewardTier {
  id: string;
  reward_config_id: string;
  service_category: ServiceCategory;
  service_category_label: string;
  reward_mode: RewardMode;
  flat_reward_amount: number | null;
  percentage_of_invoice: number | null;
  percentage_reward_cap: number | null;
  invoice_tier_json: InvoiceBracket[] | null;
  min_invoice_total: number;
  max_invoice_total: number | null;
  referee_discount_amount: number;
  referee_discount_type: DiscountType;
  referee_discount_label: string;
  charity_match_mode: CharityMatchMode;
  charity_match_percent: number | null;
  charity_match_flat: number | null;
  charity_match_floor: number;
  charity_match_cap: number | null;
  requires_admin_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Charity {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  website_url: string | null;
  fulfillment_method: CharityFulfillment;
  tremendous_charity_id: string | null;
  ein: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Referrer {
  id: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  service_titan_id: string | null;
  referral_code: string;
  referral_link: string;
  reward_preference: RewardType;
  assigned_reward_config_id: string | null;
  triple_win_enabled: boolean;
  selected_charity_id: string | null;
  total_earned: number;
  total_donated_on_their_behalf: number;
  lifetime_referrals: number;
  is_active: boolean;
  enrolled_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_name: string;
  referred_email: string | null;
  referred_phone: string;
  referred_address: string | null;
  service_requested: string;
  notes: string | null;
  service_titan_lead_id: string | null;
  service_titan_customer_id: string | null;
  service_titan_job_id: string | null;
  service_titan_invoice_id: string | null;
  invoice_total: number | null;
  service_category: ServiceCategory | null;
  reward_config_id: string | null;
  snapshot_tier_json: Record<string, unknown> | null;
  triple_win_activated: boolean;
  snapshot_charity_id: string | null;
  status: ReferralStatus;
  submitted_at: string;
  job_completed_at: string | null;
  reward_issued_at: string | null;
}

export interface Reward {
  id: string;
  referral_id: string;
  referrer_id: string;
  amount: number;
  type: RewardType;
  status: RewardStatus;
  tremendous_order_id: string | null;
  tremendous_status: string | null;
  service_titan_credit_id: string | null;
  charity_name: string | null;
  issued_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharityDonation {
  id: string;
  referral_id: string;
  charity_id: string;
  amount: number;
  status: DonationStatus;
  fulfillment_reference: string | null;
  issued_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  processing_error: string | null;
  received_at: string;
}
