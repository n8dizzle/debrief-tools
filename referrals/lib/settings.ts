import { getServerSupabase } from "@/lib/supabase";

export interface Setting {
  key: string;
  value: string | null;
  label: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Fetch a single setting value. Returns null if the row exists but value is
 * unset, or if the row is missing. Callers treat null as "not configured".
 *
 * Real DB errors (RLS change, network failure) are logged via console.error
 * so they don't masquerade as "not configured" silently — the caller still
 * receives null, but the ops signal is preserved.
 */
export async function getSetting(key: string): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error(`getSetting(${key}) failed:`, error);
    return null;
  }
  return (data?.value as string | null) ?? null;
}

export async function getAllSettings(): Promise<Setting[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_settings")
    .select("*")
    .order("key", { ascending: true });
  if (error) {
    console.error("getAllSettings failed:", error);
    return [];
  }
  return (data as Setting[]) || [];
}

/**
 * Update a setting value. Throws if the key is not pre-registered in
 * ref_settings (unknown keys are a caller bug, not a user mistake) or if
 * the DB write fails. The API route translates thrown errors into 4xx/5xx
 * so the admin UI can show the right message instead of a fake "Saved ✓".
 */
export async function setSetting(
  key: string,
  value: string | null,
  updatedBy: string
): Promise<void> {
  const supabase = getServerSupabase();
  // updated_at is set by the BEFORE UPDATE trigger in migration 004 —
  // don't pass it here or the two writes will duplicate each other.
  const { data, error } = await supabase
    .from("ref_settings")
    .update({ value, updated_by: updatedBy })
    .eq("key", key)
    .select("key");

  if (error) {
    throw new Error(`setSetting(${key}) failed: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`setSetting: unknown key "${key}"`);
  }
}
