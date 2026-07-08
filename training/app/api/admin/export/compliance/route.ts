import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireManager } from "@/lib/require-manager";

export const runtime = "nodejs";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fmt = (t: string | null) => (t ? new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "");

// Compliance export as CSV (all assignments). Manager-gated; a browser download
// carries the session cookie so requireManager passes.
export async function GET() {
  const email = await requireManager();
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("train_assignments")
    .select("status, assigned_at, due_at, completed_at, person:train_people(name, phone), training:train_trainings(title)")
    .neq("status", "revoked")
    .order("assigned_at", { ascending: false });

  type Row = { status: string; assigned_at: string | null; due_at: string | null; completed_at: string | null; person: { name: string; phone: string | null } | null; training: { title: string } | null };
  const now = Date.now();
  const header = ["Person", "Phone", "Training", "Status", "Assigned", "Due", "Completed"];
  const lines = [header.join(",")];
  for (const r of (data || []) as unknown as Row[]) {
    const overdue = r.status !== "completed" && r.due_at && new Date(r.due_at).getTime() < now;
    lines.push([
      csvCell(r.person?.name), csvCell(r.person?.phone), csvCell(r.training?.title),
      csvCell(r.status === "completed" ? "completed" : overdue ? "overdue" : r.status),
      csvCell(fmt(r.assigned_at)), csvCell(fmt(r.due_at)), csvCell(fmt(r.completed_at)),
    ].join(","));
  }

  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-compliance-${stamp}.csv"`,
    },
  });
}
