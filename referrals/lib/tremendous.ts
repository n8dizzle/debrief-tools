/**
 * Tremendous API client (https://tremendous.com/).
 * Used to fulfill gift-card rewards and charity donations in one API.
 *
 * Env vars (set in Vercel project):
 *   TREMENDOUS_API_KEY
 *   TREMENDOUS_FUNDING_SOURCE_ID
 *   TREMENDOUS_VISA_PRODUCT_ID
 *   TREMENDOUS_AMAZON_PRODUCT_ID
 *   TREMENDOUS_CHARITY_PRODUCT_ID       (generic charity product; individual
 *                                        charity IDs stored per-charity on
 *                                        ref_charities.tremendous_charity_id)
 *   TREMENDOUS_ENV=production|sandbox   (default production)
 */

interface TremendousOrderResponse {
  order: {
    id: string;
    status: string;
    created_at: string;
  };
}

export interface TremendousOrderInput {
  amount: number;
  currency?: string;
  recipient: {
    name: string;
    email: string;
  };
  productId: string;
  deliveryMethod?: "EMAIL" | "LINK";
  customFields?: Array<{ id: string; value: string }>;
}

export type TremendousProduct = "VISA" | "AMAZON" | "CHARITY";

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

  getProductId(product: TremendousProduct): string | null {
    const map: Record<TremendousProduct, string | undefined> = {
      VISA: process.env.TREMENDOUS_VISA_PRODUCT_ID,
      AMAZON: process.env.TREMENDOUS_AMAZON_PRODUCT_ID,
      CHARITY: process.env.TREMENDOUS_CHARITY_PRODUCT_ID,
    };
    return map[product] || null;
  }

  /**
   * Create a Tremendous order — delivers the reward to the recipient's email.
   * Returns the order ID on success, or throws.
   */
  async createOrder(input: TremendousOrderInput): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Tremendous credentials not configured");
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
          products: [input.productId],
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
    return data.order.id;
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
