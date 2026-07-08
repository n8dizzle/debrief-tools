import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentTech } from "@/lib/tech-auth";
import { generateCode, hashCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendSMS } from "@/lib/quo";

export const runtime = "nodejs";

// Cookie-authed. Texts a fresh 6-digit code to the signed-in tech's phone.
export async function POST() {
  const tech = await getCurrentTech();
  if (!tech) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!tech.phone) return NextResponse.json({ ok: false, error: "no phone on file" }, { status: 400 });

  const code = generateCode();
  const supabase = getServerSupabase();
  await supabase.from("train_otp_codes").insert({
    person_id: tech.id,
    code_hash: hashCode(code),
    purpose: "signature",
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60000).toISOString(),
  });

  const sent = await sendSMS(tech.phone, `Christmas Air signing code: ${code} (expires in ${OTP_TTL_MINUTES} min)`);
  if (!sent.success) return NextResponse.json({ ok: false, error: "could not text code" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
