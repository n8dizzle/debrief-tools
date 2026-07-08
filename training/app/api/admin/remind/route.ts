import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/require-manager";
import { sendReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manual "Remind" button. Body: { scope?: "overdue" | "pending" } (default overdue).
export async function POST(req: NextRequest) {
  const email = await requireManager();
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let scope: "overdue" | "pending" = "overdue";
  try { const b = await req.json(); if (b?.scope === "pending") scope = "pending"; } catch {}
  try {
    const r = await sendReminders(scope);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
