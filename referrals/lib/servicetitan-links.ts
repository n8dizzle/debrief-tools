/**
 * Deep-link helpers for ServiceTitan's web admin (go.servicetitan.com).
 *
 * ST uses hash-based SPA routes. These paths work for the Texas tenant; if
 * ServiceTitan changes them we only need to edit this one file and every
 * admin-side link updates.
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
