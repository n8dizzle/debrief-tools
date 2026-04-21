import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { finalizeConversion } from "@/lib/webhooks/finalize-conversion";
import type { Referral, ServiceCategory } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Simulate an invoice-paid conversion for the admin's testing loop.
 *
 * Runs the same finalize-conversion helper the real webhook uses — so
 * whatever works here will work in production, and whatever breaks here
 * would have broken on a real invoice too. The difference is we skip the
 * ServiceTitan fetches (job + invoice) and trust the admin-provided
 * invoice total + category instead.
 *
 * SAFETY: hard-gated on TREMENDOUS_ENV=sandbox. Flipping to production
 * Tremendous + leaving this endpoint reachable would be a gift-card
 * liability, so it explicitly refuses when sandbox is unset.
 *
 * The service_titan_invoice_id is stamped with a SIM-{timestamp} prefix
 * so simulated conversions are visually distinct in audit queries.
 */
const Schema = z.object({
  invoiceTotal: z.number().positive().max(100000),
  actualCategory: z.enum([
    "SERVICE_CALL",
    "MAINTENANCE",
    "REPLACEMENT",
    "COMMERCIAL",
  ]),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Safety gate — never let this run against production Tremendous credentials.
  const env = (process.env.TREMENDOUS_ENV || "production").toLowerCase();
  if (env !== "sandbox") {
    return NextResponse.json(
      {
        error:
          "Simulate-completion is only available with TREMENDOUS_ENV=sandbox. Real rewards on real funding sources must go through the actual ST invoice webhook.",
      },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;

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
  const { data: referralRow } = await supabase
    .from("ref_referrals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!referralRow) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  const referral = referralRow as Referral;
  if (
    referral.status === "COMPLETED" ||
    referral.status === "REWARD_ISSUED"
  ) {
    return NextResponse.json(
      {
        error: `Referral already ${referral.status}. Reset it in SQL if you want to re-run the simulation.`,
      },
      { status: 409 }
    );
  }

  const syntheticInvoiceId = `SIM-${Date.now()}`;

  const result = await finalizeConversion({
    referral,
    invoiceTotal: parsed.data.invoiceTotal,
    actualCategory: parsed.data.actualCategory as ServiceCategory,
    serviceTitanJobId: null,
    serviceTitanInvoiceId: syntheticInvoiceId,
    simulated: true,
  });

  return NextResponse.json({
    ok: true,
    syntheticInvoiceId,
    ...result,
  });
}
