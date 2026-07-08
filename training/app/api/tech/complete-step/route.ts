import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentTech } from "@/lib/tech-auth";
import { OTP_RECENT_VERIFY_MINUTES } from "@/lib/otp";

export const runtime = "nodejs";

// Tech submits one step. Cookie-authed. Quiz is graded SERVER-SIDE (the answer key
// never goes to the client). Records an append-only completion and advances the
// assignment; when all required steps are done, marks it completed.
export async function POST(req: NextRequest) {
  const tech = await getCurrentTech();
  if (!tech) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { assignment_id?: string; step_id?: string; answers?: number[]; watch_pct?: number; typed_name?: string; signature?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  const { assignment_id, step_id } = body;
  if (!assignment_id || !step_id) return NextResponse.json({ ok: false, error: "assignment_id and step_id required" }, { status: 400 });

  const supabase = getServerSupabase();

  // Ownership: the assignment must belong to this tech.
  const { data: assignment } = await supabase
    .from("train_assignments")
    .select("id, training_id, person_id, status")
    .eq("id", assignment_id)
    .single();
  if (!assignment || assignment.person_id !== tech.id) {
    return NextResponse.json({ ok: false, error: "not your assignment" }, { status: 403 });
  }
  if (assignment.status === "revoked") return NextResponse.json({ ok: false, error: "assignment revoked" }, { status: 410 });

  const { data: step } = await supabase
    .from("train_steps").select("id, training_id, type, config").eq("id", step_id).single();
  if (!step || step.training_id !== assignment.training_id) {
    return NextResponse.json({ ok: false, error: "step not in this training" }, { status: 400 });
  }

  // Grade / validate by type.
  const cfg = (step.config || {}) as Record<string, unknown>;
  let quiz_score: number | null = null;
  const watch_pct = typeof body.watch_pct === "number" ? body.watch_pct : null;

  if (step.type === "quiz") {
    const questions = (cfg.questions as Array<{ correct_index: number }>) || [];
    const answers = body.answers || [];
    if (answers.length !== questions.length) return NextResponse.json({ ok: false, error: "answer count mismatch" }, { status: 400 });
    const correct = questions.reduce((n, q, i) => n + (answers[i] === q.correct_index ? 1 : 0), 0);
    quiz_score = questions.length ? Math.round((correct / questions.length) * 100) : 100;
    const threshold = typeof cfg.pass_threshold === "number" ? (cfg.pass_threshold as number) : 80;
    if (quiz_score < threshold) {
      // Not recorded — let them retry.
      return NextResponse.json({ ok: true, passed: false, score: quiz_score, threshold });
    }
  }

  // Signature step: require a recently-verified OTP + typed name + drawn signature.
  let verified_via = "link";
  let signature_typed_name: string | null = null;
  let signature_image_url: string | null = null;
  if (step.type === "signature") {
    const typed = (body.typed_name || "").trim();
    const sig = body.signature || "";
    if (!typed || !sig) return NextResponse.json({ ok: false, error: "typed name and signature required" }, { status: 400 });
    const cut = new Date(Date.now() - OTP_RECENT_VERIFY_MINUTES * 60000).toISOString();
    const { count } = await supabase
      .from("train_otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("person_id", tech.id).eq("purpose", "signature")
      .not("consumed_at", "is", null).gte("consumed_at", cut);
    if (!count) return NextResponse.json({ ok: false, error: "verify your identity first" }, { status: 403 });
    verified_via = "sms_otp";
    signature_typed_name = typed;
    signature_image_url = sig;
  }

  // Record completion (idempotent on assignment+step).
  const fwd = req.headers.get("x-forwarded-for") || "";
  await supabase.from("train_step_completions").upsert({
    assignment_id, step_id,
    quiz_score, watch_pct,
    verified_via,
    signature_typed_name,
    signature_image_url,
    ip: fwd.split(",")[0] || null,
    user_agent: req.headers.get("user-agent") || null,
    from_phone: tech.phone,
  }, { onConflict: "assignment_id,step_id", ignoreDuplicates: true });

  // Recompute progress: required steps vs completed.
  const { data: allSteps } = await supabase
    .from("train_steps").select("id, required").eq("training_id", assignment.training_id);
  const requiredIds = (allSteps || []).filter((s) => s.required).map((s) => s.id);
  const { data: done } = await supabase
    .from("train_step_completions").select("step_id").eq("assignment_id", assignment_id);
  const doneIds = new Set((done || []).map((d) => d.step_id));
  const allDone = requiredIds.every((id) => doneIds.has(id));

  await supabase.from("train_assignments").update({
    status: allDone ? "completed" : "in_progress",
    completed_at: allDone ? new Date().toISOString() : null,
    current_step_index: (allSteps || []).findIndex((s) => !doneIds.has(s.id)),
    updated_at: new Date().toISOString(),
  }).eq("id", assignment_id);

  return NextResponse.json({ ok: true, passed: true, score: quiz_score, completed: allDone });
}
