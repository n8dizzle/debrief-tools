import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Bulk-mark all APPROVED donations for a given charity as CONFIRMED (paid).
 * Used when finance cuts a single check covering a batch of donations to the
 * same charity. Stamps every donation in the batch with the same payout date
 * + reference so reconciliation stays clean. Only APPROVED rows are touched;
 * PENDING rows (unapproved) and already-CONFIRMED rows are left alone.
 */
const Schema = z.object({
  charityId: z.string().uuid(),
  paidAt: z.string().datetime(),
  reference: z.string().trim().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_approve_donations");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Also bump each affected referrer's total_donated_on_their_behalf
  // counter. Cheaper to compute in the DB than in a loop — fetch the rows
  // first, then apply updates in parallel.
  const { data: affected, error: fetchErr } = await supabase
    .from("ref_charity_donations")
    .select("id, amount, referral_id")
    .eq("charity_id", parsed.data.charityId)
    .eq("status", "APPROVED");

  if (fetchErr) {
    console.error("mark-paid-bulk fetch failed:", fetchErr);
    return NextResponse.json({ error: "Database read failed" }, { status: 500 });
  }

  if (!affected || affected.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const { error: updateErr } = await supabase
    .from("ref_charity_donations")
    .update({
      status: "CONFIRMED",
      fulfillment_reference: parsed.data.reference,
      issued_at: parsed.data.paidAt,
    })
    .eq("charity_id", parsed.data.charityId)
    .eq("status", "APPROVED");

  if (updateErr) {
    console.error("mark-paid-bulk update failed:", updateErr);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  // Bump the lifetime charity impact counter per referrer. Best-effort —
  // the donations are already CONFIRMED, so a counter-update failure here
  // only affects display numbers, not the payout record.
  const byReferrer = new Map<string, number>();
  const referralIds = affected.map((d) => d.referral_id);
  const { data: refs } = await supabase
    .from("ref_referrals")
    .select("id, referrer_id")
    .in("id", referralIds);
  const referrerByReferral = new Map(
    (refs || []).map((r) => [r.id, r.referrer_id as string])
  );
  for (const d of affected) {
    const rid = referrerByReferral.get(d.referral_id);
    if (!rid) continue;
    byReferrer.set(rid, (byReferrer.get(rid) || 0) + Number(d.amount));
  }
  await Promise.all(
    Array.from(byReferrer.entries()).map(async ([referrerId, delta]) => {
      const { data: current } = await supabase
        .from("ref_referrers")
        .select("total_donated_on_their_behalf")
        .eq("id", referrerId)
        .single();
      if (!current) return;
      await supabase
        .from("ref_referrers")
        .update({
          total_donated_on_their_behalf:
            Number(current.total_donated_on_their_behalf) + delta,
        })
        .eq("id", referrerId);
    })
  );

  return NextResponse.json({ ok: true, count: affected.length });
}
