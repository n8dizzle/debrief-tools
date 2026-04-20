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
 */
export async function getSetting(key: string): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as string | null) ?? null;
}

export async function getAllSettings(): Promise<Setting[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_settings")
    .select("*")
    .order("key", { ascending: true });
  return (data as Setting[]) || [];
}

export async function setSetting(
  key: string,
  value: string | null,
  updatedBy: string
): Promise<void> {
  const supabase = getServerSupabase();
  await supabase
    .from("ref_settings")
    .update({
      value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);
}
