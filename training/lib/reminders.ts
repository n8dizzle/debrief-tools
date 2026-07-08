import { getServerSupabase } from "@/lib/supabase";
import { issueMagicLinkToken } from "@/lib/tech-auth";
import { sendSMS } from "@/lib/quo";

const THROTTLE_HOURS = 18; // don't re-nudge the same person within this window

export interface ReminderResult { texted: number; skipped: number; issues: string[] }

// Text people who still owe training. scope="overdue" only nudges past-due; "pending"
// nudges anything not completed. Respects phone + opt-out + a per-person throttle so
// nobody gets spammed. Used by the manual "Remind" button and the daily cron.
export async function sendReminders(scope: "overdue" | "pending"): Promise<ReminderResult> {
  const supabase = getServerSupabase();
  const now = Date.now();
  const result: ReminderResult = { texted: 0, skipped: 0, issues: [] };

  const { data: assignments } = await supabase
    .from("train_assignments")
    .select("id, status, due_at, person:train_people(id, name, phone, active, sms_opt_out), training:train_trainings(title)")
    .not("status", "in", "(completed,revoked,undeliverable)");

  type A = { id: string; status: string; due_at: string | null;
    person: { id: string; name: string; phone: string | null; active: boolean; sms_opt_out: boolean } | null;
    training: { title: string } | null };

  // Group outstanding assignments by person (one text per person, even if they owe several).
  const byPerson = new Map<string, { name: string; phone: string; count: number; title: string }>();
  for (const a of (assignments || []) as unknown as A[]) {
    const p = a.person;
    if (!p || !p.active || !p.phone || p.sms_opt_out) continue;
    if (scope === "overdue" && !(a.due_at && new Date(a.due_at).getTime() < now)) continue;
    const cur = byPerson.get(p.id);
    if (cur) { cur.count++; }
    else byPerson.set(p.id, { name: p.name, phone: p.phone, count: 1, title: a.training?.title || "training" });
  }

  const base = (process.env.NEXTAUTH_URL || "https://training.christmasair.com").replace(/\/$/, "");
  const throttleCut = new Date(now - THROTTLE_HOURS * 3600 * 1000).toISOString();

  for (const [personId, info] of byPerson) {
    // Throttle: skip if we already texted this person recently.
    const { count: recent } = await supabase
      .from("train_sms_log")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId)
      .gte("created_at", throttleCut);
    if (recent && recent > 0) { result.skipped++; continue; }

    const token = await issueMagicLinkToken(personId);
    const link = `${base}/t/${token}`;
    const msg = info.count > 1
      ? `Christmas Air: you have ${info.count} trainings to finish. Tap: ${link}`
      : `Christmas Air reminder: finish "${info.title}". Tap: ${link}`;
    const sent = await sendSMS(info.phone, msg);
    await supabase.from("train_sms_log").insert({
      person_id: personId, direction: "outbound", body: msg,
      provider_msg_id: sent.messageId || null, status: sent.success ? "accepted" : "failed",
    });
    if (sent.success) result.texted++;
    else { result.skipped++; result.issues.push(`${info.name}: send failed`); }
  }

  return result;
}
