import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null as any;

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use in API routes, never expose to client
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================
// BPP TRACKER TYPES
// ============================================

export interface BPPCategory {
  id: string;
  name: string;
  description: string | null;
  depreciation_type: 'declining_balance' | 'straight_line' | 'custom';
  useful_life_years: number;
  sort_order: number;
  created_at: string;
  // Computed
  asset_count?: number;
  total_value?: number;
}

export interface BPPAsset {
  id: string;
  category_id: string;
  description: string;
  subcategory: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number; // generated column
  year_acquired: number;
  condition: 'new' | 'good' | 'fair' | 'poor';
  location: string | null;
  serial_number: string | null;
  notes: string | null;
  disposed: boolean;
  disposed_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  category?: BPPCategory;
  // Computed
  depreciated_value?: number;
  age?: number;
}

export interface BPPRendition {
  id: string;
  tax_year: number;
  county: string;
  status: 'draft' | 'filed' | 'accepted';
  filed_date: string | null;
  due_date: string | null;
  extension_filed: boolean;
  extension_date: string | null;
  total_historical_cost: number | null;
  total_market_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BPPDepreciationSchedule {
  id: string;
  category_id: string;
  age_years: number;
  depreciation_percent: number;
  created_at: string;
  // Joined
  category?: BPPCategory;
}

export interface BPPDashboardStats {
  total_assets: number;
  total_historical_cost: number;
  total_depreciated_value: number;
  disposed_count: number;
  categories: {
    id: string;
    name: string;
    asset_count: number;
    historical_cost: number;
    depreciated_value: number;
  }[];
  recent_assets: BPPAsset[];
  current_rendition: BPPRendition | null;
}

export interface BPPRenditionSummary {
  category_id: string;
  category_name: string;
  items: {
    year_acquired: number;
    count: number;
    historical_cost: number;
    depreciated_value: number;
  }[];
  total_historical_cost: number;
  total_depreciated_value: number;
}
