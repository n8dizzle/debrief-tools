import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (!_client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");
    _client = new Resend(apiKey);
  }
  return _client;
}

export function getFromAddress(): string {
  const email = process.env.FROM_EMAIL || "howdy@christmasair.com";
  const name = process.env.FROM_NAME || "Christmas Air";
  return `${name} <${email}>`;
}
