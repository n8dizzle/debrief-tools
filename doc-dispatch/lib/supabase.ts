import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// Types

export interface DdDocument {
  id: string;
  uploaded_by: string;
  image_path: string;
  image_url: string | null;
  document_type: string | null;
  title: string | null;
  summary: string | null;
  extracted_data: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'in_progress' | 'complete';
  analyzed_at: string | null;
  analysis_model: string | null;
  analysis_error: string | null;
  assigned_to: string | null;
  drive_file_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  uploader?: { name: string; email: string };
  owner?: { id: string; name: string; email: string } | null;
  action_items?: DdActionItem[];
  pages?: DdDocumentPage[];
  note_attachments?: DdNoteAttachment[];
}

export interface DdDocumentPage {
  id: string;
  document_id: string;
  image_path: string;
  page_number: number;
  rotation: number;
  created_at: string;
  // Runtime only (signed URL)
  image_url?: string;
}

export interface DdActionItem {
  id: string;
  document_id: string;
  description: string;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'dismissed';
  source: 'ai' | 'manual';
  assignee_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee?: { name: string; email: string };
}

export interface DdNoteAttachment {
  id: string;
  document_id: string;
  image_path: string;
  filename: string;
  uploaded_by: string;
  created_at: string;
  // Runtime only (signed URL)
  image_url?: string;
}

export interface DdChatMessage {
  id: string;
  document_id: string;
  role: 'user' | 'assistant';
  content: string;
  user_id: string | null;
  created_at: string;
}
