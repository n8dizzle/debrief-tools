import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side Supabase client (uses service role key, bypasses RLS).
// Only use in API routes / server code, never expose to the client.
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Fall back to anon key if service role not set.
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
  department?: Department;
}

// ============================================
// HR HUB — INSTALL LADDER TYPES
// ============================================

export type SkillStatus = 'not_started' | 'in_progress' | 'verified';

/** A technician on the install roster (mirrored live from ap_technicians). */
export interface InstallTech {
  st_technician_id: number;
  name: string;
  is_active: boolean;
  business_unit_name: string | null;
  is_install_lead: boolean;
  hourly_rate: number | null;
  // ladder state (from hr_tech_ladder)
  current_rung_id: string | null;
  hire_date: string | null;
  notes: string | null;
}

/** One skill checkoff row (hr_tech_skill_status). */
export interface TechSkillStatus {
  st_technician_id: number;
  skill_id: string;
  status: SkillStatus;
  note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string;
}
