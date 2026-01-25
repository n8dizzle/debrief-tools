import { createClient } from '@supabase/supabase-js';
import type { UserPermissions } from './permissions';

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
  permissions: UserPermissions | null;
  // Joined data
  department?: Department;
}

// ============================================
// GBP POSTS TYPES
// ============================================

export type GBPPostTopicType = 'STANDARD' | 'EVENT' | 'OFFER';
export type GBPPostStatus = 'draft' | 'publishing' | 'published' | 'failed';
export type GBPPostLocationStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface GBPPost {
  id: string;
  summary: string;
  topic_type: GBPPostTopicType;
  cta_type: string | null;
  cta_url: string | null;
  event_title: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  coupon_code: string | null;
  redeem_url: string | null;
  terms_conditions: string | null;
  media_urls: string[]; // JSONB stored as array of URLs
  status: GBPPostStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_user?: PortalUser;
  locations?: GBPPostLocation[];
}

export interface GBPPostLocation {
  id: string;
  post_id: string;
  location_id: string;
  google_post_id: string | null;
  google_post_url: string | null;
  state: string | null;
  status: GBPPostLocationStatus;
  error_message: string | null;
  published_at: string | null;
  // Joined data
  location?: GoogleLocation;
}

export interface GBPMedia {
  id: string;
  name: string;
  url: string;
  storage_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  // Joined data
  uploaded_by_user?: PortalUser;
}

export interface GoogleLocation {
  id: string;
  name: string;
  short_name: string;
  place_id: string | null;
  google_account_id: string | null;
  google_location_id: string | null;
  address: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// MARKETING TASKS TYPES
// ============================================

export type MarketingTaskType = 'daily' | 'weekly' | 'monthly' | 'one_time';
export type MarketingTaskCategory = 'social' | 'gbp' | 'reviews' | 'reporting' | 'other';
export type MarketingTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface MarketingTask {
  id: string;
  title: string;
  description: string | null;
  task_type: MarketingTaskType;
  category: MarketingTaskCategory | null;
  status: MarketingTaskStatus;
  due_date: string | null;
  recurrence_day: number | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined data
  assigned_to_user?: PortalUser;
  completed_by_user?: PortalUser;
  created_by_user?: PortalUser;
}
