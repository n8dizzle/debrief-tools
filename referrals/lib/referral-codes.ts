import { customAlphabet } from "nanoid";
import { getServerSupabase } from "@/lib/supabase";

// Unambiguous alphabet — no 0/O, 1/I/L — so customers can read codes aloud without confusion
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const nanoid = customAlphabet(CODE_ALPHABET, 4);

function sanitizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8) || "FRIEND";
}

/**
 * Generate a memorable, unique referral code like "SARAH-4K2M".
 * Retries up to 5 times on collision before falling back to a fully-random code.
 */
export async function generateReferralCode(firstName: string): Promise<string> {
  const prefix = sanitizeName(firstName);
  const supabase = getServerSupabase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${nanoid()}`;
    const { data } = await supabase
      .from("ref_referrers")
      .select("id")
      .eq("referral_code", candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  // Extremely unlikely — fall back to fully-random 8-char code
  return `REF-${nanoid()}${nanoid()}`;
}
