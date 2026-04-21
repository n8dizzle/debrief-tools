/**
 * Tremendous API client (https://tremendous.com/).
 * Used to fulfill gift-card rewards and charity donations in one API.
 *
 * Env vars (set in Vercel project):
 *   TREMENDOUS_API_KEY
 *   TREMENDOUS_FUNDING_SOURCE_ID
 *   TREMENDOUS_CAMPAIGN_ID              (required for gift-card rewards;
 *                                        Tremendous campaign bundling many
 *                                        card options — recipient picks at
 *                                        redemption. Admin manages the
 *                                        catalog in the Tremendous dashboard.)
 *   TREMENDOUS_CHARITY_PRODUCT_ID       (generic charity product; individual
 *                                        charity IDs stored per-charity on
 *                                        ref_charities.tremendous_charity_id)
 *   TREMENDOUS_ENV=production|sandbox   (default production)
 */

interface TremendousOrderResponse {
  order: {
    id: string;
    status: string; // pending_approval | approved | executed | declined | failed
    created_at: string;
  };
}

export interface TremendousOrderResult {
  orderId: string;
  /**
   * Raw status from Tremendous at order-creation time. "pending_approval"
   * means the org has order-approvals configured and a human has to approve
   * inside Tremendous before the reward delivers. "approved" / "executed"
   * means it went straight through.
   */
  status: string;
}

export interface TremendousOrderInput {
  amount: number;
  currency?: string;
  recipient: {
    name: string;
    email: string;
  };
  /** Specific product (Visa, Amazon, specific charity, etc.). */
  productId?: string;
  /**
   * Tremendous campaign (bundle of many products, recipient picks at redeem
   * time). Mutually exclusive with productId — pass one or the other.
   */
  campaignId?: string;
  deliveryMethod?: "EMAIL" | "LINK";
  customFields?: Array<{ id: string; value: string }>;
}

/**
 * How a reward is routed inside Tremendous:
 *  - GIFT_CARD → campaign (recipient picks any card in the bundle at redeem)
 *  - CHARITY   → specific charity product ID (charity routing is per-charity,
 *                not bundled, since the donation must name a specific nonprofit)
 */
export type TremendousProduct = "GIFT_CARD" | "CHARITY";

export class TremendousClient {
  private readonly BASE_URL: string;
  private apiKey: string;
  private fundingSourceId: string;

  constructor() {
    const env = (process.env.TREMENDOUS_ENV || "production").toLowerCase();
    this.BASE_URL =
      env === "sandbox"
        ? "https://testflight.tremendous.com/api/v2"
        : "https://api.tremendous.com/api/v2";

    this.apiKey = process.env.TREMENDOUS_API_KEY || "";
    this.fundingSourceId = process.env.TREMENDOUS_FUNDING_SOURCE_ID || "";
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.fundingSourceId);
  }

  /**
   * Tremendous campaign for gift-card rewards. Recipient picks any card from
   * the campaign bundle at redemption. Returns null if not configured.
   */
  getCampaignId(): string | null {
    return process.env.TREMENDOUS_CAMPAIGN_ID || null;
  }

  /**
   * Specific-product IDs. GIFT_CARD intentionally returns null — gift cards
   * always route via the campaign; there is no fallback product because a
   * silent fallback (e.g. "just send a Visa instead") would hide a broken
   * campaign config. CHARITY returns the generic charity product ID.
   */
  getProductId(product: TremendousProduct): string | null {
    if (product === "CHARITY") {
      return process.env.TREMENDOUS_CHARITY_PRODUCT_ID || null;
    }
    return null;
  }

  /**
   * Create a Tremendous order. If order-approvals are configured on the
   * Tremendous org, the returned status will be "pending_approval" and the
   * reward does NOT deliver until a human approves inside the Tremendous
   * dashboard. Otherwise status is "approved" / "executed" and delivery
   * begins immediately. Throws on API failure.
   */
  async createOrder(input: TremendousOrderInput): Promise<TremendousOrderResult> {
    if (!this.isConfigured()) {
      throw new Error("Tremendous credentials not configured");
    }
    if (!input.campaignId && !input.productId) {
      throw new Error(
        "createOrder requires either a campaignId or a productId"
      );
    }
    if (input.campaignId && input.productId) {
      throw new Error(
        "createOrder: campaignId and productId are mutually exclusive"
      );
    }

    const body = {
      payment: { funding_source_id: this.fundingSourceId },
      rewards: [
        {
          value: {
            denomination: input.amount,
            currency_code: input.currency || "USD",
          },
          delivery: { method: input.deliveryMethod || "EMAIL" },
          recipient: input.recipient,
          ...(input.campaignId
            ? { campaign_id: input.campaignId }
            : { products: [input.productId] }),
          ...(input.customFields && { custom_fields: input.customFields }),
        },
      ],
    };

    const response = await fetch(`${this.BASE_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tremendous API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as TremendousOrderResponse;
    return { orderId: data.order.id, status: data.order.status };
  }

  /**
   * Fetch current status of a previously-created order. Used to check whether
   * a pending-approval order has been approved/declined on the Tremendous
   * side, without requiring a webhook subscription.
   */
  async getOrderStatus(orderId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${this.BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as TremendousOrderResponse;
      return data.order.status || null;
    } catch {
      return null;
    }
  }

  /** Customer-facing dashboard host, used for building deep-link URLs. */
  dashboardHost(): string {
    return this.BASE_URL.includes("testflight")
      ? "https://testflight.tremendous.com"
      : "https://app.tremendous.com";
  }

  /**
   * Lightweight health check — verifies credentials by hitting /ping equivalent.
   */
  async ping(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.BASE_URL}/funding_sources`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

let _client: TremendousClient | null = null;

export function getTremendousClient(): TremendousClient {
  if (!_client) _client = new TremendousClient();
  return _client;
}
