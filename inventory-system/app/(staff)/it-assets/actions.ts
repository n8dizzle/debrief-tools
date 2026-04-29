'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createItAsset, updateItAsset, type ItAssetInput } from '@/lib/services/it-assets';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readItAssetForm(formData: FormData): ItAssetInput {
  const costRaw = formData.get('purchase_cost');
  const mdmRaw = formData.get('mdm_enrolled');
  return {
    asset_type: ((formData.get('asset_type') as string) || '').trim() || undefined,
    manufacturer: ((formData.get('manufacturer') as string) || '').trim() || undefined,
    model: ((formData.get('model') as string) || '').trim() || undefined,
    serial_number: ((formData.get('serial_number') as string) || '').trim() || undefined,
    asset_tag: ((formData.get('asset_tag') as string) || '').trim() || null,
    imei: ((formData.get('imei') as string) || '').trim() || null,
    udid: ((formData.get('udid') as string) || '').trim() || null,
    department: ((formData.get('department') as string) || '').trim() || null,
    purchase_date: ((formData.get('purchase_date') as string) || '').trim() || null,
    purchase_cost: costRaw ? Number(costRaw) || null : null,
    vendor: ((formData.get('vendor') as string) || '').trim() || null,
    warranty_expiry: ((formData.get('warranty_expiry') as string) || '').trim() || null,
    mdm_enrolled: mdmRaw === 'on' ? true : null,
    carrier: ((formData.get('carrier') as string) || '').trim() || null,
    phone_number: ((formData.get('phone_number') as string) || '').trim() || null,
    status: ((formData.get('status') as string) || '').trim() || null,
    notes: ((formData.get('notes') as string) || '').trim() || null,
  };
}

export async function createItAssetAction(formData: FormData) {
  await requireRole();
  const asset = await createItAsset(readItAssetForm(formData));
  revalidatePath('/it-assets');
  redirect(`/it-assets/${asset.id}`);
}

export async function updateItAssetAction(assetId: string, formData: FormData) {
  await requireRole();
  await updateItAsset(assetId, readItAssetForm(formData));
  revalidatePath('/it-assets');
  revalidatePath(`/it-assets/${assetId}`);
  redirect(`/it-assets/${assetId}`);
}
