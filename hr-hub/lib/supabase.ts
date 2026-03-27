import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Server-side Supabase client (uses service role key, bypasses RLS)
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
// HR HUB TYPES
// ============================================

export interface HRWorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  workflow_type: 'onboarding' | 'offboarding';
  department_id: string | null;
  is_base: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  phases?: HRTemplatePhase[];
  portal_departments?: { id: string; name: string; slug: string } | null;
}

export interface HRTemplatePhase {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  relative_start_day: number;
  relative_end_day: number;
  created_at: string;
  updated_at: string;
  steps?: HRTemplateStep[];
}

export interface HRTemplateStep {
  id: string;
  phase_id: string;
  template_id: string;
  title: string;
  description: string | null;
  guidance_text: string | null;
  responsible_role: 'recruiter' | 'hiring_manager' | 'leadership' | 'hr' | 'employee';
  relative_due_day: number;
  is_conditional: boolean;
  condition_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HROnboarding {
  id: string;
  employee_name: string;
  employee_email: string | null;
  employee_phone: string | null;
  department_id: string | null;
  position_title: string;
  trade: string | null;
  start_date: string;
  template_id: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  hiring_manager_id: string | null;
  recruiter_id: string | null;
  created_by: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  portal_departments?: { id: string; name: string; slug: string } | null;
  hiring_manager?: { id: string; name: string; email: string } | null;
  recruiter?: { id: string; name: string; email: string } | null;
  tasks?: HROnboardingTask[];
}

export interface HROnboardingTask {
  id: string;
  onboarding_id: string;
  template_step_id: string | null;
  phase_name: string;
  phase_sort_order: number;
  title: string;
  description: string | null;
  guidance_text: string | null;
  responsible_role: 'recruiter' | 'hiring_manager' | 'leadership' | 'hr' | 'employee';
  assigned_to: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'na';
  is_conditional: boolean;
  condition_label: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assigned_user?: { id: string; name: string; email: string } | null;
  completed_by_user?: { id: string; name: string } | null;
}

export interface HRActivityLog {
  id: string;
  onboarding_id: string;
  task_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
  actor?: { id: string; name: string } | null;
}

export type ResponsibleRole = 'recruiter' | 'hiring_manager' | 'leadership' | 'hr' | 'employee';
