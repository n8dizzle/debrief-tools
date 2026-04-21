import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { issueMagicLinkToken } from "@/lib/customer-auth";
import { sendTripleWinAnnouncementEmail } from "@/lib/email/triple-win-announcement";
import type { Referrer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * One-time (per referrer) batched send of the Triple Win announcement.
 * Targets active referrers with no charity picked and no prior announcement.
 * Returns a summary so the admin sees exactly what happened.
 */
export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServerSupabase();
  const { data: candidates, error: queryError } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("is_active", true)
    .is("selected_charity_id", null)
    .is("triple_win_announcement_sent_at", null);

  if (queryError) {
    console.error("Announcement query failed:", queryError);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }

  const referrers = (candidates || []) as Referrer[];
  if (referrers.length === 0) {
    return NextResponse.json({
      ok: true,
      eligible: 0,
      sent: 0,
      failed: 0,
      message: "No referrers are eligible — everyone has either picked a charity or already been notified.",
    });
  }

  const appUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const now = new Date().toISOString();

  // Sequential sending keeps it simple and avoids Resend rate-limit surprises;
  // the audience is small (tens, not thousands). Failures are logged per-user
  // so one bad email address doesn't block the rest.
  let sent = 0;
  const failures: { referrerId: string; email: string; reason: string }[] = [];

  for (const referrer of referrers) {
    try {
      const token = await issueMagicLinkToken(referrer.id);
      const dashboardUrl = `${appUrl}/api/auth/customer/callback?token=${encodeURIComponent(token)}&next=/dashboard/charity`;

      await sendTripleWinAnnouncementEmail({ referrer, dashboardUrl });

      const { error: updateError } = await supabase
        .from("ref_referrers")
        .update({ triple_win_announcement_sent_at: now })
        .eq("id", referrer.id);

      if (updateError) {
        // Email went out but we couldn't mark it — log loudly so next run
        // doesn't resend. Admin can reconcile by checking Resend logs.
        console.error(
          `Sent announcement to ${referrer.email} but failed to update ` +
            `triple_win_announcement_sent_at:`,
          updateError
        );
      }

      sent++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`Announcement to ${referrer.email} failed:`, reason);
      failures.push({ referrerId: referrer.id, email: referrer.email, reason });
    }
  }

  return NextResponse.json({
    ok: true,
    eligible: referrers.length,
    sent,
    failed: failures.length,
    failures: failures.length > 0 ? failures : undefined,
  });
}
