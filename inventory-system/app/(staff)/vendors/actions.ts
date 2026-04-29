'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupplyHouse, updateSupplyHouse, type SupplyHouseInput } from '@/lib/services/supply-houses';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readVendorForm(formData: FormData): SupplyHouseInput {
  const leadTimeRaw = formData.get('lead_time_days');
  const poDayRaw = formData.get('preferred_po_day');
  return {
    name: ((formData.get('name') as string) || '').trim() || undefined,
    contact_email: ((formData.get('contact_email') as string) || '').trim() || undefined,
    account_number: ((formData.get('account_number') as string) || '').trim() || null,
    contact_name: ((formData.get('contact_name') as string) || '').trim() || null,
    contact_phone: ((formData.get('contact_phone') as string) || '').trim() || null,
    department: ((formData.get('department') as string) || '').trim() || null,
    lead_time_days: leadTimeRaw ? Number(leadTimeRaw) || null : null,
    preferred_po_day: poDayRaw ? Number(poDayRaw) || null : null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
    is_active: true,
  };
}

export async function createVendorAction(formData: FormData) {
  await requireRole();
  const vendor = await createSupplyHouse(readVendorForm(formData));
  revalidatePath('/vendors');
  redirect(`/vendors/${vendor.id}`);
}

export async function updateVendorAction(vendorId: string, formData: FormData) {
  await requireRole();
  await updateSupplyHouse(vendorId, readVendorForm(formData));
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${vendorId}`);
  redirect(`/vendors/${vendorId}`);
}
