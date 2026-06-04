import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey);
  }
  return createClient(url, anonKey);
}

export type POStatus = 'open' | 'completed' | 'cancelled';

export interface POOrder {
  job_id: string;
  st_url: string | null;
  customer_name: string | null;
  technician: string | null;
  job_type: string | null;
  date_added: string | null;
  owner: string | null;
  location: string | null;
  supplier: string | null;
  order_number: string | null;
  part_description: string | null;
  part_cost: string | null;
  is_equipment: boolean;
  warranty: string | null;
  eta_date: string | null;
  scheduled_date: string | null;
  notes_warehouse: string | null;
  notes_cxr: string | null;
  bo_notified: boolean;
  bo_notified_date: string | null;
  cancel_source: string | null;
  cancel_reason: string | null;
  status: POStatus;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface POAuditLog {
  id: number;
  job_id: string | null;
  event_type: string | null;
  action: string | null;
  detail: string | null;
  performed_by: string | null;
  created_at: string;
}
