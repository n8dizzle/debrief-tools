import { NextRequest } from 'next/server';

export function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export function hasPEPermission(
  session: any,
  permission: string
): boolean {
  if (!session?.user) return false;
  if (session.user.role === 'owner') return true;
  return !!session.user.permissions?.parts_equipment?.[permission];
}

export function ownerForLocation(location: string, isEquipment: boolean): string {
  const warehouseLocations = ['Place Order', 'Shipping to Shop', 'P/U Supply House', 'Shipping to Supplier'];
  if (warehouseLocations.includes(location)) return 'Warehouse';
  if (location === 'Lewisville Shop') return isEquipment ? 'Install Manager' : 'CXR';
  if (location === 'Backordered') return 'CXR';
  if (location === 'Waiting for Tech/Cus') return 'Service Manager';
  if (location === 'Duct Cleaning - Schedule') return 'Rachel';
  return '';
}

export function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
