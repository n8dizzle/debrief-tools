import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { issueMagicLinkToken } from "@/lib/customer-auth";
import { sendMagicLinkEmail } from "@/lib/email/magic-link";

const SendSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const supabase = getServerSupabase();

  // Look up referrer. If they exist, send the link.
  // Return the same response whether or not they're enrolled — don't leak enrollment status.
  const { data: referrer } = await supabase
    .from("ref_referrers")
    .select("id, email, first_name")
    .eq("email", email)
    .eq("is_active", true)
    .single();

  if (referrer) {
    const token = await issueMagicLinkToken(referrer.id);
    const url = `${process.env.NEXTAUTH_URL}/api/auth/customer/callback?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail({
      to: referrer.email,
      firstName: referrer.first_name,
      loginUrl: url,
    });
  }

  return NextResponse.json({ sent: true });
}
