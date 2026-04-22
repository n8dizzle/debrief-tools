import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getAllSettings, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().max(500).nullable(),
});

// Per-key shape validators. Catches "abc" or "12,345" at save time so the
// admin sees the error in the editor, not in a silent failure log later.
const PER_KEY_VALIDATORS: Record<string, (v: string) => string | null> = {
  st_referral_campaign_id: (v) =>
    /^\d+$/.test(v) ? null : "Must be a numeric ServiceTitan campaign ID",
  st_referral_booking_provider_id: (v) =>
    /^\d+$/.test(v) ? null : "Must be a numeric ServiceTitan booking provider ID",
  st_customer_referral_code_field_id: (v) =>
    /^\d+$/.test(v) ? null : "Must be a numeric ServiceTitan custom field type ID",
};

// Keys hidden from the admin UI and blocked at the API layer. Defense in
// depth with the UI filter in app/admin/settings/page.tsx. PR2 deletes the
// row + the kill-switch code; until then this keeps the pin from being
// flipped by anyone crafting a direct API call.
const DENYLISTED_KEYS = new Set(["triple_win_enabled"]);

export async function GET() {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await getAllSettings();
  const visible = settings.filter((s) => !DENYLISTED_KEYS.has(s.key));
  return NextResponse.json({ settings: visible });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (DENYLISTED_KEYS.has(parsed.data.key)) {
    return NextResponse.json(
      { error: "Unknown setting key" },
      { status: 404 }
    );
  }

  const normalized = parsed.data.value?.trim() || null;

  if (normalized !== null) {
    const validator = PER_KEY_VALIDATORS[parsed.data.key];
    const validationError = validator ? validator(normalized) : null;
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  try {
    await setSetting(parsed.data.key, normalized, admin.email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUnknownKey = msg.includes("unknown key");
    return NextResponse.json(
      { error: isUnknownKey ? "Unknown setting key" : "Save failed" },
      { status: isUnknownKey ? 404 : 500 }
    );
  }

  return NextResponse.json({ ok: true, key: parsed.data.key, value: normalized });
}
