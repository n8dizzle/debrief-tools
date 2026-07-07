import { NextRequest, NextResponse } from "next/server";
import { syncRoster } from "@/lib/roster-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily roster sync from ServiceTitan (+ portal_users) into train_people.
// GET + POST both supported (Vercel cron uses GET). Auth: CRON_SECRET via
// x-cron-secret header or ?secret=, matching the house cron pattern.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || bearer === secret || query === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncRoster();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
