import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getTremendousClient } from "@/lib/tremendous";

export const dynamic = "force-dynamic";

// Hard cap on test order value so a typo can't fire a $10,000 gift card by
// accident. In sandbox this is play money, but keeping the same ceiling in
// production protects against fat-finger mistakes too.
const MAX_TEST_AMOUNT = 100;

const Schema = z.object({
  recipientName: z.string().trim().min(1).max(100),
  recipientEmail: z.string().email().max(254),
  amount: z.number().positive().max(MAX_TEST_AMOUNT),
});

export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_manage_settings");
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
      {
        error:
          parsed.error.issues[0]?.message ||
          `Invalid input (amount must be $1–$${MAX_TEST_AMOUNT}).`,
      },
      { status: 400 }
    );
  }

  const client = getTremendousClient();
  if (!client.isConfigured()) {
    return NextResponse.json(
      { error: "Tremendous credentials not configured" },
      { status: 500 }
    );
  }

  // All gift-card test orders route via the Tremendous campaign. No silent
  // fallback — if the campaign isn't configured the test should fail loudly
  // so the admin notices and fixes it.
  const campaignId = client.getCampaignId();
  if (!campaignId) {
    return NextResponse.json(
      {
        error:
          "TREMENDOUS_CAMPAIGN_ID not set. Configure a Tremendous campaign and add its ID to env vars.",
      },
      { status: 500 }
    );
  }

  try {
    void admin;
    const { orderId, status } = await client.createOrder({
      amount: parsed.data.amount,
      recipient: {
        name: parsed.data.recipientName,
        email: parsed.data.recipientEmail,
      },
      campaignId,
    });
    return NextResponse.json({ ok: true, orderId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Tremendous test order failed:", message);
    return NextResponse.json(
      { error: message.slice(0, 500) },
      { status: 500 }
    );
  }
}
