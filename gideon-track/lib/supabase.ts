import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
    return createClient(url, anonKey);
  }
  return createClient(url, serviceRoleKey);
}

// ---- Types ----

export type UserRole = 'admin' | 'tutor' | 'parent';

export interface GideonUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  active_role: UserRole;
  password_hash: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
}

export interface CurriculumLevel {
  id: string;
  subject_id: string;
  name: string;
  passing_threshold: number;
  sort_order: number;
  subject?: Subject;
}

export interface Series {
  id: string;
  level_id: string;
  name: string;
  passing_threshold_override: number | null;
  sort_order: number;
  level?: CurriculumLevel;
}

export interface Booklet {
  id: string;
  series_id: string;
  name: string;
  passing_threshold_override: number | null;
  sort_order: number;
  series?: Series;
}

export interface Student {
  id: string;
  name: string;
  date_of_birth: string | null;
  enrollment_date: string;
  status: 'active' | 'inactive' | 'graduated';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentStudent {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string;
}

export interface TutorStudent {
  id: string;
  tutor_id: string;
  student_id: string;
}

export interface SessionLog {
  id: string;
  student_id: string;
  booklet_id: string;
  tutor_id: string;
  session_date: string;
  rep_number: number;
  mistakes: number;
  passed: boolean;
  notes: string | null;
  created_at: string;
  student?: Student;
  booklet?: Booklet;
  tutor?: GideonUser;
}

export interface StudentBookletProgress {
  id: string;
  student_id: string;
  booklet_id: string;
  status: 'in_progress' | 'passed' | 'skipped';
  date_pulled: string;
  date_passed: string | null;
  total_reps: number;
  best_score: number | null;
}

export interface StudentPosition {
  id: string;
  student_id: string;
  subject_id: string;
  current_booklet_id: string;
  updated_at: string;
  subject?: Subject;
  current_booklet?: Booklet & {
    series?: Series & {
      level?: CurriculumLevel;
    };
  };
}
