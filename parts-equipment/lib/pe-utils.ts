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

export function ageColor(days: number): string {
  if (days > 30) return '#c0392b'; // red
  if (days > 20) return '#e67e22'; // amber
  return '#27ae60'; // green
}

// Location→owner reference map. No longer auto-applied on location change (team
// found the auto-handoff surprising), but retained as the documented workflow
// legend and for possible future use.
export function ownerForLocation(location: string, isInstall: boolean): string | null {
  if (isInstall) {
    switch (location) {
      case 'Place Order':
      case 'Cancel PO':
        return 'Parts Coordinator';
      case 'Shipping to Shop':
      case 'P/U Supply House':
      case 'Shipping to Supplier':
        return 'Warehouse';
      case 'Lewisville Shop':
        return 'Install Manager';
      case 'Backordered':
      case 'Waiting for Customer':
      case 'Waiting for Tech/Cus':
        return 'Install Dispatcher';
      default:
        return null;
    }
  }
  // Service-side owner-by-location, per the workflow legend.
  switch (location) {
    case 'Place Order':
      return 'Parts Coordinator';
    case 'Shipping to Shop':
      return 'Warehouse';
    case 'Lewisville Shop':
      return 'Service Dispatcher';
    case 'Backordered':
      return 'CXR Team';
    case 'P/U Supply House':
      return 'Warehouse';
    case 'Waiting for Customer':
    case 'Waiting for Tech/Cus':
      return 'CXR Team';
    case 'Cancel PO':
      return 'Parts Coordinator';
    case 'Shipping to Supplier':
      return 'Parts Coordinator';
    case 'Duct Cleaning - Schedule':
      return 'Install Dispatcher';
    default:
      return null;
  }
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
