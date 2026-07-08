import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentTech } from "@/lib/tech-auth";
import { hashCode, OTP_MAX_ATTEMPTS } from "@/lib/otp";

export const runtime = "nodejs";

// Cookie-authed. Verifies the 6-digit code. On success marks it consumed — the sign
// submit then checks for a recently-consumed OTP.
export async function POST(req: NextRequest) {
  const tech = await getCurrentTech();
  if (!tech) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let code = "";
  try { code = String((await req.json())?.code || "").trim(); } catch {}
  if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: otp } = await supabase
    .from("train_otp_codes")
    .select("id, code_hash, expires_at, consumed_at, attempts")
    .eq("person_id", tech.id)
    .eq("purpose", "signature")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otp) return NextResponse.json({ ok: false, error: "request a new code" }, { status: 400 });
  if (otp.expires_at && new Date(otp.expires_at).getTime() < Date.now())
    return NextResponse.json({ ok: false, error: "code expired — request a new one" }, { status: 400 });
  if (otp.attempts >= OTP_MAX_ATTEMPTS)
    return NextResponse.json({ ok: false, error: "too many tries — request a new code" }, { status: 429 });

  if (hashCode(code) !== otp.code_hash) {
    await supabase.from("train_otp_codes").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return NextResponse.json({ ok: false, error: "wrong code" }, { status: 400 });
  }

  await supabase.from("train_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  return NextResponse.json({ ok: true });
}
