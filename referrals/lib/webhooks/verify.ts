import crypto from "crypto";

/**
 * Verify ServiceTitan webhook signature.
 * ST signs requests with HMAC-SHA256 of the raw body using a shared key
 * configured in the developer portal. Signature is sent via header.
 *
 * Returns true when the signature matches or when HMAC is explicitly disabled
 * (ST_WEBHOOK_HMAC_KEY unset) — useful in dev. Production deploys should ALWAYS
 * set the key; the route handler refuses to start without it.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const key = process.env.ST_WEBHOOK_HMAC_KEY;
  if (!key) {
    console.warn("ST_WEBHOOK_HMAC_KEY not set — accepting unsigned webhook (DEV ONLY)");
    return true;
  }
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", key).update(rawBody).digest("hex");

  // Constant-time compare to avoid timing attacks
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
