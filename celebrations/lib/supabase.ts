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

// ============================================
// CELEBRATIONS TYPES
// ============================================

export type BoardType = 'birthday' | 'company' | 'farewell' | 'holiday' | 'custom';
export type BoardVisibility = 'public' | 'internal';
export type BoardStatus = 'active' | 'archived';
export type PostContentType = 'text' | 'photo' | 'gif' | 'video';
export type PostSource = 'web' | 'slack';

export interface CelBoard {
  id: string;
  title: string;
  description: string | null;
  board_type: BoardType;
  slug: string;
  visibility: BoardVisibility;
  status: BoardStatus;
  honoree_name: string | null;
  event_date: string | null;
  cover_image_url: string | null;
  allow_anonymous: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined
  post_count?: number;
}

export interface CelPost {
  id: string;
  board_id: string;
  content_type: PostContentType;
  text_content: string | null;
  media_url: string | null;
  media_storage_path: string | null;
  media_thumbnail_url: string | null;
  media_width: number | null;
  media_height: number | null;
  author_name: string;
  author_email: string | null;
  author_avatar_url: string | null;
  author_user_id: string | null;
  source: PostSource;
  slack_message_ts: string | null;
  slack_channel_id: string | null;
  background_color: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  reactions?: CelReaction[];
}

export interface CelReaction {
  id: string;
  post_id: string;
  emoji: string;
  reactor_name: string;
  reactor_user_id: string | null;
  created_at: string;
}

export interface CelSlackConfig {
  id: string;
  board_id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CelActivityLog {
  id: string;
  board_id: string | null;
  action: string;
  details: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

// Helper to generate a URL-friendly slug
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// Board type display labels
export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  birthday: 'Birthday',
  company: 'Company Milestone',
  farewell: 'Farewell',
  holiday: 'Holiday',
  custom: 'Custom',
};

// Board type emoji
export const BOARD_TYPE_EMOJI: Record<BoardType, string> = {
  birthday: '\uD83C\uDF82',
  company: '\uD83C\uDF1F',
  farewell: '\uD83D\uDC4B',
  holiday: '\uD83C\uDF84',
  custom: '\u2728',
};

// Background color presets for text posts
export const TEXT_BG_COLORS = [
  '#5D8A66', // Christmas green
  '#7B3F3F', // Christmas brown
  '#B8956B', // Christmas gold
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#1C231E', // Dark (default)
];
