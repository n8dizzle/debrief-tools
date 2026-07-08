import { createHash, randomInt } from "crypto";

// OTP step-up for signatures. A 6-digit code is texted to the tech's phone; they enter
// it before signing (forwarding-resistance + deliberate intent). Short-lived, attempt-capped.
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RECENT_VERIFY_MINUTES = 10; // a consumed OTP counts as "verified" this long

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Hash the code with the app secret so plaintext codes are never stored.
export function hashCode(code: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "";
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}
