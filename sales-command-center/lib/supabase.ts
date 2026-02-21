import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client with service role (for API routes)
export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key');
    return supabase;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// Database types for TypeScript
export interface DbLead {
  id: string;
  client_name: string;
  lead_type: 'TGL' | 'Marketed';
  source: string;
  tech_name: string | null;
  status: string;
  assigned_advisor_id: string | null;
  estimated_value: number;
  gross_margin_percent: number;
  gross_margin_dollar: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  service_titan_id: string | null;
  unit_age: number | null;
  system_type: string | null;
  created_at: string;
}

export interface DbComfortAdvisor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  in_queue: boolean;
  tgl_queue_position: number;
  marketed_queue_position: number;
  sales_mtd: number;
  average_sale: number;
  closing_rate: number;
  sales_opps: number;
  total_leads: number;
  sold_leads: number;
  service_titan_id: string | null;
  created_at: string;
}

export interface DbServiceTitanConfig {
  id: string;
  client_id: string;
  client_secret: string;
  app_key: string;
  tenant_id: string;
  environment: string;
  updated_at: string;
}
