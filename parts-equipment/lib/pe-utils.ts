import type { PEOrder } from '@/types';

// CRITICAL: Never use toISOString().split('T')[0] — that converts to UTC
// Always use local date components for Texas/Central Time
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse a YYYY-MM-DD string as local date (not UTC)
export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  // Parse as local date components to avoid UTC offset issues
  const parts = dateStr.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return 0;
  const d = new Date(y, m - 1, day);
  const now = new Date();
  const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((nowLocal.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// Format a stored cost value as a US dollar amount for display / on-blur
// normalization (e.g. "382.5" or "$382.50" -> "$382.50"). Empty stays empty;
// unparseable input is returned unchanged so we never destroy manual text.
export function fmtMoney(v: string | null | undefined): string {
  if (v == null) return '';
  const raw = String(v).trim();
  if (!raw) return '';
  const num = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return raw;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Generic cell comparator for column sorting: money/plain numbers sort numerically,
// ISO dates (YYYY-MM-DD) sort chronologically as strings, everything else alphabetically.
// Blank values always sort to the end.
const SORT_NUM_RE = /^-?\$?[\d,]+(\.\d+)?$/;
export function compareValues(a: unknown, b: unknown): number {
  const av = a == null ? '' : String(a).trim();
  const bv = b == null ? '' : String(b).trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  if (SORT_NUM_RE.test(av) && SORT_NUM_RE.test(bv)) {
    return parseFloat(av.replace(/[$,]/g, '')) - parseFloat(bv.replace(/[$,]/g, ''));
  }
  return av.localeCompare(bv, 'en', { sensitivity: 'base' });
}

export function ageColor(days: number): string {
  if (days > 30) return '#c0392b'; // red
  if (days > 20) return '#e67e22'; // amber
  return '#27ae60'; // green
}

export function autoOwnerFromCheckboxes(order: Partial<PEOrder>, isInstall: boolean): string | null {
  if (isInstall) {
    if (order.call_booked) return 'Install Dispatcher';
    if (order.bo_informed) return 'Warehouse';
    if (order.bo_ordered) return 'Parts Coordinator';
    return null;
  } else {
    if (order.parts_at_shop) return 'CXR Team';
    if (order.bo_informed) return 'Warehouse';
    if (order.part_bo) return 'Service Dispatcher';
    return null;
  }
}

export function rowClass(o: PEOrder): string {
  if (o.status === 'completed') return 'row-completed';
  if (o.status === 'cancelled') return 'row-cancelled';
  // State colors override the owner color: Backordered and Cancel PO are
  // locations in the workflow legend, so they drive their own row color and
  // clear automatically once the location changes (e.g. part arrives).
  if (o.location === 'Cancel PO') return 'row-cancel-pending';
  if (o.location === 'Backordered') return 'row-backordered';
  switch (o.owner) {
    case 'Service Dispatcher': return 'row-dispatcher';
    case 'Warehouse': return 'row-warehouse';
    case 'CXR Team': return 'row-cxr';
    case 'Install Manager': return 'row-install-mgr';
    case 'Install Dispatcher': return 'row-install-disp';
    case 'Parts Coordinator': return 'row-parts-coord';
    case 'Service Manager': return 'row-svc-mgr';
    case 'Plumbing Dispatcher': return 'row-plumbing-disp';
    case 'Commercial': return 'row-commercial';
    case 'Christina': return 'row-christina';
    default: return 'row-unassigned';
  }
}

export function locationPillClass(loc: string): string {
  if (loc === 'Backordered') return 'pill pill-red';
  if (loc === 'Place Order') return 'pill pill-blue';
  if (loc === 'Lewisville Shop') return 'pill pill-green';
  if (loc === 'Shipping to Shop') return 'pill pill-amber';
  return 'pill';
}

export function ownerBadgeClass(owner: string): string {
  switch (owner) {
    case 'Service Dispatcher': return 'badge badge-dispatcher';
    case 'Warehouse': return 'badge badge-warehouse';
    case 'CXR Team': return 'badge badge-cxr';
    case 'Install Manager': return 'badge badge-install-mgr';
    case 'Install Dispatcher': return 'badge badge-install-disp';
    case 'Parts Coordinator': return 'badge badge-parts-coord';
    case 'Service Manager': return 'badge badge-svc-mgr';
    case 'Plumbing Dispatcher': return 'badge badge-plumbing-disp';
    case 'Commercial': return 'badge badge-commercial';
    default: return 'badge badge-unassigned';
  }
}

export function hasPEPermission(session: any, perm: string): boolean {
  if (!session?.user) return false;
  if (session.user.role === 'owner') return true;
  return !!session.user.permissions?.parts_equipment?.[perm];
}

// A stored install_team value that looks like a number/currency is bad data —
// a rate that landed in the team field. Don't surface it as a selectable "team".
export function looksLikeCurrency(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^\$?\s*[\d,]+(\.\d+)?$/.test(v.trim());
}

export function isValidCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// The clean pipeline fields (migrations 008/009). `stage` = fulfillment position
// (the primary inline control the team advances); `blocked` = orthogonal parked
// reason; `location` (in constants.ts) = physical place only. These arrays are the
// single source of truth for both the dropdown options and the display labels.
export const STAGES = [
  { value: 'needs_order', label: 'Needs Order' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'staged', label: 'Staged' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
// Blocked reasons are now manager-editable and DB-backed (pe_blocked_reasons via
// /api/blocked-reasons + useOrders().blockedReasons). Physical locations likewise
// live in pe_locations. Stage stays a fixed state machine (code keys off values).

const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.value, s.label]));
export function stageLabel(s: string | null | undefined): string {
  return s ? (STAGE_LABELS[s] || s) : '—';
}
