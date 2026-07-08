import { NextRequest, NextResponse } from "next/server";
import { sendReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily auto-reminder: nudge anyone with overdue training (throttled per person).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || bearer === secret || query === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const r = await sendReminders("overdue");
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
