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
export type PostStatus = 'approved' | 'pending' | 'rejected';

export interface SlackImportFilters {
  media_only?: boolean;
  min_reactions?: number;
  reaction_emojis?: string[];
  keywords_include?: string[];
  keywords_exclude?: string[];
}

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
  view_count: number;
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
  status: PostStatus;
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
  import_filters: SlackImportFilters;
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

// ============================================
// VALUE CHAMPION NOMINATIONS
// ============================================

export type NominationPeriodStatus = 'draft' | 'open' | 'closed';
export type NominationPeriodType = 'quarterly' | 'annual';

export interface NominationCategory {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

export interface CelNominationPeriod {
  id: string;
  title: string;
  description: string | null;
  period_type: NominationPeriodType;
  year: number | null;
  quarter: number | null; // 1-4, only for quarterly
  status: NominationPeriodStatus;
  opens_at: string | null;
  closes_at: string | null;
  categories: NominationCategory[];
  winners: Record<string, string>; // category key → winner name
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined
  nomination_count?: number;
}

export const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan–Mar)',
  2: 'Q2 (Apr–Jun)',
  3: 'Q3 (Jul–Sep)',
  4: 'Q4 (Oct–Dec)',
};

export const QUARTER_DATES: Record<number, { start: string; end: string }> = {
  1: { start: '01-01', end: '03-31' },
  2: { start: '04-01', end: '06-30' },
  3: { start: '07-01', end: '09-30' },
  4: { start: '10-01', end: '12-31' },
};

export function generatePeriodTitle(type: NominationPeriodType, year: number, quarter?: number): string {
  if (type === 'annual') return `${year} Annual Awards`;
  return `Q${quarter} ${year} - Company Values`;
}

export function generatePeriodDates(type: NominationPeriodType, year: number, quarter?: number) {
  if (type === 'annual') {
    return { opens_at: `${year}-01-01`, closes_at: `${year}-12-31` };
  }
  const q = QUARTER_DATES[quarter || 1];
  return { opens_at: `${year}-${q.start}`, closes_at: `${year}-${q.end}` };
}

export interface CelNomination {
  id: string;
  period_id: string;
  nominee_name: string;
  nominator_user_id: string | null;
  nominator_name: string;
  company_value: string;
  story: string;
  event_date: string | null;
  source: 'form' | 'voice';
  created_at: string;
}

export const COMPANY_VALUES: NominationCategory[] = [
  { key: 'serve_others', label: 'Serve Others', emoji: '🤝', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
  { key: 'be_an_owner', label: 'Be an Owner', emoji: '👑', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  { key: 'keep_promises', label: 'Keep Promises', emoji: '💪', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { key: 'have_fun', label: 'Have Fun', emoji: '🎉', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
];

export const CATEGORY_TEMPLATES: Record<string, { label: string; categories: NominationCategory[] }> = {
  company_values: {
    label: 'Company Values (Quarterly)',
    categories: COMPANY_VALUES,
  },
  annual: {
    label: 'Annual Awards',
    categories: [],
  },
};

export function getCategoryByKey(key: string, categories: NominationCategory[]): NominationCategory | undefined {
  return categories.find(c => c.key === key) || COMPANY_VALUES.find(c => c.key === key);
}
