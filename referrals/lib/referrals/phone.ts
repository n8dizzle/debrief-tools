/**
 * Normalize a phone number to digits only, stripping country code for US numbers.
 * "(469) 214-2013" → "4692142013"
 * "+1 469 214 2013" → "4692142013"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}
