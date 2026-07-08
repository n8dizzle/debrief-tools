import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireManager } from "@/lib/require-manager";

export const runtime = "nodejs";

// Create a training + its ordered steps. Body:
// { title, description?, status?, steps: [{ type, config, required? }] }
export async function POST(req: NextRequest) {
  const email = await requireManager();
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { title?: string; description?: string; status?: string; steps?: Array<{ type: string; config?: unknown; required?: boolean }> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 }); }

  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  const steps = body.steps || [];
  const validTypes = new Set(["video", "document", "quiz", "signature"]);
  if (steps.some((s) => !validTypes.has(s.type))) {
    return NextResponse.json({ ok: false, error: "invalid step type" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: training, error } = await supabase
    .from("train_trainings")
    .insert({ title, description: body.description || null, status: body.status || "published" })
    .select("id")
    .single();
  if (error || !training) return NextResponse.json({ ok: false, error: error?.message || "create failed" }, { status: 500 });

  if (steps.length) {
    const rows = steps.map((s, i) => ({
      training_id: training.id,
      order_index: i,
      type: s.type,
      required: s.required !== false,
      config: s.config || {},
    }));
    const { error: stepErr } = await supabase.from("train_steps").insert(rows);
    if (stepErr) return NextResponse.json({ ok: false, error: stepErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: training.id });
}
