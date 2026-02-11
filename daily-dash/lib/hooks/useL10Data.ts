import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  });

const CACHE_OPTIONS = {
  refreshInterval: 5 * 60 * 1000,
  dedupingInterval: 5 * 1000,
  revalidateOnMount: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  keepPreviousData: true,
};

// ============================================
// Types
// ============================================

export interface RotationMember {
  id: string;
  member_name: string;
  user_id: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryHistory {
  id: string;
  week_date: string;
  rotation_member_id: string | null;
  member_name: string;
  is_told: boolean;
  told_at: string | null;
  notes: string | null;
  is_override: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryWeek {
  week_date: string;
  member_name: string;
  rotation_member_id: string | null;
  is_told: boolean;
  told_at: string | null;
  notes: string | null;
  is_override: boolean;
  history_id: string | null;
}

export interface Rock {
  id: string;
  title: string;
  owner_names: string[];
  owner_ids: string[];
  department: string | null;
  status: 'on_track' | 'off_track' | 'done';
  target_quarter: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  title: string;
  owner_name: string;
  owner_id: string | null;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  title: string;
  priority: string | null;
  owner_name: string | null;
  owner_id: string | null;
  notes: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingRating {
  id: string;
  meeting_date: string;
  user_id: string;
  user_name: string;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface RatingsSummary {
  date: string;
  ratings: MeetingRating[];
  average: number | null;
  feedback_note: string | null;
}

export interface RatingTrend {
  week_date: string;
  average: number;
  count: number;
}

export interface MeetingHistoryRow {
  meeting_date: string;
  average: number;
  feedback_note: string | null;
  ratings: { user_id: string; user_name: string; rating: number }[];
}

export interface RatingsHistoryResponse {
  meetings: MeetingHistoryRow[];
  participants: { user_id: string; user_name: string }[];
}

// ============================================
// Hooks
// ============================================

export function useStories() {
  const { data, error, isLoading, mutate } = useSWR<{
    current_week: StoryWeek;
    upcoming: StoryWeek[];
    past: StoryHistory[];
  }>('/api/l10/stories', fetcher, CACHE_OPTIONS);

  return { data, error, isLoading, mutate };
}

export function useRotation() {
  const { data, error, isLoading, mutate } = useSWR<{
    members: RotationMember[];
  }>('/api/l10/stories/rotation', fetcher, CACHE_OPTIONS);

  return { members: data?.members, error, isLoading, mutate };
}

export function useRocks(quarter?: string) {
  const url = quarter ? `/api/l10/rocks?quarter=${quarter}` : '/api/l10/rocks';
  const { data, error, isLoading, mutate } = useSWR<{
    rocks: Rock[];
    quarters: string[];
  }>(url, fetcher, CACHE_OPTIONS);

  return { rocks: data?.rocks, quarters: data?.quarters, error, isLoading, mutate };
}

export function useTodos(filter?: 'all' | 'open' | 'done') {
  const url = filter && filter !== 'all' ? `/api/l10/todos?filter=${filter}` : '/api/l10/todos';
  const { data, error, isLoading, mutate } = useSWR<{
    todos: Todo[];
  }>(url, fetcher, CACHE_OPTIONS);

  return { todos: data?.todos, error, isLoading, mutate };
}

export function useIssues() {
  const { data, error, isLoading, mutate } = useSWR<{
    issues: Issue[];
  }>('/api/l10/issues', fetcher, CACHE_OPTIONS);

  return { issues: data?.issues, error, isLoading, mutate };
}

export function useRatings(date?: string) {
  const url = date ? `/api/l10/ratings?date=${date}` : '/api/l10/ratings';
  const { data, error, isLoading, mutate } = useSWR<{
    current: RatingsSummary;
    trend: RatingTrend[];
  }>(url, fetcher, CACHE_OPTIONS);

  return { data, error, isLoading, mutate };
}

export function useRatingsHistory() {
  const { data, error, isLoading, mutate } = useSWR<RatingsHistoryResponse>(
    '/api/l10/ratings/history',
    fetcher,
    CACHE_OPTIONS
  );

  return { data, error, isLoading, mutate };
}

export function usePortalUsers() {
  const { data, error, isLoading } = useSWR<{
    users: { id: string; name: string; email: string }[];
  }>('/api/l10/users', fetcher, {
    ...CACHE_OPTIONS,
    refreshInterval: 0, // Users don't change often
  });

  return { users: data?.users, error, isLoading };
}

export function useDepartments() {
  const { data, error, isLoading } = useSWR<{ id: string; name: string; slug: string }[]>(
    '/api/departments',
    fetcher,
    { ...CACHE_OPTIONS, refreshInterval: 0 }
  );

  return { departments: data, error, isLoading };
}
