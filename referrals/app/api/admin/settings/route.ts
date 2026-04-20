import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getAllSettings, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().max(500).nullable(),
});

export async function GET() {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
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

  const normalized = parsed.data.value?.trim() || null;
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
