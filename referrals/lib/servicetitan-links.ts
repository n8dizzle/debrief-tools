/**
 * Deep-link helpers for external admin dashboards. Centralized here so if any
 * vendor changes their URL scheme we edit one file instead of hunting call
 * sites.
 */

const ST_BASE = "https://go.servicetitan.com";

export function stCustomerUrl(id: string | number | null | undefined): string | null {
  if (!id) return null;
  return `${ST_BASE}/#/Customer/${id}`;
}

export function stLeadUrl(id: string | number | null | undefined): string | null {
  if (!id) return null;
  return `${ST_BASE}/#/Lead/${id}`;
}

export function stBookingUrl(id: string | number | null | undefined): string | null {
  if (!id) return null;
  // ServiceTitan routes booking provider submissions through the Bookings
  // management screen. Deep link is a best-effort guess — if the tenant
  // uses a different path, adjusting this single call site updates every
  // pill in the admin UI.
  return `${ST_BASE}/#/BookingProviderManagement/Booking/${id}`;
}

/**
 * Tremendous order page. Sandbox and production live on different hosts, so
 * we take the env explicitly — pass the env string from the server context
 * (`process.env.TREMENDOUS_ENV`) so the link routes to the matching dashboard.
 */
export function tremendousOrderUrl(
  id: string | null | undefined,
  env: string | null | undefined = "production"
): string | null {
  if (!id) return null;
  const host =
    (env || "production").toLowerCase() === "sandbox"
      ? "https://testflight.tremendous.com"
      : "https://app.tremendous.com";
  return `${host}/rewards/${id}`;
}
