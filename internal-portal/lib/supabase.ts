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

// Get portal user by email (server-side)
export async function getPortalUser(email: string): Promise<PortalUser | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("portal_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !data) return null;
  return data as PortalUser;
}

// Types for our portal tables
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
  permissions: Record<string, Record<string, boolean>> | null;
  // Joined data
  department?: Department;
}

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string;
  section: 'Tools' | 'Resources' | 'Marketing' | 'Quick Links';
  category: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  departments?: Department[];
}

export interface ToolPermission {
  id: string;
  tool_id: string;
  department_id: string;
  created_at: string;
}

export interface ToolUsage {
  id: string;
  user_id: string;
  tool_id: string;
  accessed_at: string;
}
