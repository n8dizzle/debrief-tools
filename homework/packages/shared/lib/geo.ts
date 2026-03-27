// @homework/shared geo
// Geography utilities for market/zip code operations.

// ---------------------------------------------------------------------------
// DFW Market Constants
// ---------------------------------------------------------------------------

/** Center of the DFW metroplex (roughly Arlington) */
export const DFW_CENTER = {
  latitude: 32.7357,
  longitude: -97.1081,
} as const;

/** Approximate radius of the DFW market in miles */
export const DFW_RADIUS_MILES = 60;

/** DFW market slug used throughout the system */
export const DFW_MARKET_SLUG = 'dfw';

/**
 * Major DFW area codes for phone number validation context.
 * Not used for enforcement, just helpful for UX hints.
 */
export const DFW_AREA_CODES = ['214', '469', '972', '817', '682', '940', '903'] as const;

// ---------------------------------------------------------------------------
// Zip Code Validation
// ---------------------------------------------------------------------------

/** US zip code regex: 5 digits or 5+4 format */
const ZIP_CODE_REGEX = /^\d{5}(-\d{4})?$/;

/**
 * Validate that a string is a properly formatted US zip code.
 */
export function isValidZipCode(zip: string): boolean {
  return ZIP_CODE_REGEX.test(zip.trim());
}

/**
 * Normalize a zip code to 5-digit format.
 */
export function normalizeZipCode(zip: string): string {
  const trimmed = zip.trim();
  // If 5+4 format, return just the first 5
  if (trimmed.includes('-')) {
    return trimmed.split('-')[0];
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Distance Calculation
// ---------------------------------------------------------------------------

/** Earth's radius in miles */
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Calculate the distance between two points using the Haversine formula.
 * Returns distance in miles.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Check if a coordinate is within the DFW market area.
 */
export function isInDFWMarket(latitude: number, longitude: number): boolean {
  const distance = calculateDistance(
    DFW_CENTER.latitude,
    DFW_CENTER.longitude,
    latitude,
    longitude
  );
  return distance <= DFW_RADIUS_MILES;
}

/**
 * Check if a coordinate is within a given radius of a center point.
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusMiles: number
): boolean {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusMiles;
}

/**
 * Sort an array of items with lat/lon by distance from a reference point.
 * Returns a new array (does not mutate the input).
 */
export function sortByDistance<T extends { latitude: number; longitude: number }>(
  items: T[],
  fromLat: number,
  fromLon: number
): (T & { distance_miles: number })[] {
  return items
    .map((item) => ({
      ...item,
      distance_miles: calculateDistance(fromLat, fromLon, item.latitude, item.longitude),
    }))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

/**
 * Format a distance in miles for display.
 * Under 0.1 miles shows "< 0.1 mi", otherwise shows 1 decimal place.
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
