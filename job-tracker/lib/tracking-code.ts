import { customAlphabet } from 'nanoid';

// Create a custom alphabet for URL-safe tracking codes
// Excluding similar characters (0, O, I, l) to avoid confusion
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

// Generate an 8-character tracking code
const nanoid = customAlphabet(alphabet, 8);

/**
 * Generate a unique, URL-safe tracking code
 * Format: 8 characters, e.g., "V1StGXR8"
 */
export function generateTrackingCode(): string {
  return nanoid();
}

/**
 * Validate a tracking code format
 * Must be 8 characters and only contain valid characters
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code || code.length !== 8) {
    return false;
  }

  const validChars = new Set(alphabet.split(''));
  return code.split('').every(char => validChars.has(char));
}

/**
 * Build the full public URL for a tracker
 */
export function getTrackerUrl(trackingCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://track.christmasair.com';
  return `${baseUrl}/${trackingCode}`;
}
