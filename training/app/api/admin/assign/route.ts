import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireManager } from "@/lib/require-manager";
import { issueMagicLinkToken } from "@/lib/tech-auth";
import { sendSMS } from "@/lib/quo";

export const runtime = "nodejs";
export const maxDuration = 60;

// Assign a training to people and text each their magic link. Body:
// { training_id, person_ids: [uuid], notify?: boolean }
export async function POST(req: NextRequest) {
  const email = await requireManager();
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { training_id?: string; person_ids?: string[]; notify?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  const trainingId = body.training_id;
  const personIds = body.person_ids || [];
  const notify = body.notify !== false;
  if (!trainingId || !personIds.length) return NextResponse.json({ ok: false, error: "training_id and person_ids required" }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: training } = await supabase.from("train_trainings").select("id, title").eq("id", trainingId).single();
  if (!training) return NextResponse.json({ ok: false, error: "training not found" }, { status: 404 });

  const { data: people } = await supabase.from("train_people").select("id, name, phone, sms_opt_out").in("id", personIds);
  const base = (process.env.NEXTAUTH_URL || "https://training.christmasair.com").replace(/\/$/, "");

  let assigned = 0, texted = 0, skipped = 0;
  const issues: string[] = [];

  for (const p of people || []) {
    // Create assignment (dedup: one per training/person/cycle). ignoreDuplicates → no re-text on re-assign.
    const { data: created } = await supabase
      .from("train_assignments")
      .upsert({ training_id: trainingId, person_id: p.id, assigned_by: null, source: "adhoc", cycle_key: "once" },
              { onConflict: "training_id,person_id,cycle_key", ignoreDuplicates: true })
      .select("id");
    const isNew = !!(created && created.length);
    if (isNew) assigned++;

    if (notify && isNew) {
      if (p.sms_opt_out) { skipped++; issues.push(`${p.name}: opted out`); continue; }
      if (!p.phone) { skipped++; issues.push(`${p.name}: no phone`); continue; }
      const token = await issueMagicLinkToken(p.id);
      const link = `${base}/t/${token}`;
      const msg = `Christmas Air training: "${training.title}". Tap to start: ${link}`;
      const sent = await sendSMS(p.phone, msg);
      await supabase.from("train_sms_log").insert({
        person_id: p.id, direction: "outbound", body: msg,
        provider_msg_id: sent.messageId || null, status: sent.success ? "accepted" : "failed",
      });
      if (sent.success) texted++; else { skipped++; issues.push(`${p.name}: send failed`); }
    }
  }

  return NextResponse.json({ ok: true, assigned, texted, skipped, issues });
}
