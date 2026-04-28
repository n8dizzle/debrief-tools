'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTruck, updateTruck, type TruckInput } from '@/lib/services/trucks';
import { updateUser } from '@/lib/services/users';

const ALLOWED = new Set(['admin', 'warehouse_manager']);

async function requireRole() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  if (!ALLOWED.has(s.user.role)) redirect('/dashboard');
  return s;
}

function readTruckForm(formData: FormData): TruckInput {
  const yearRaw = formData.get('year');
  return {
    truck_number: ((formData.get('truck_number') as string) || '').trim() || undefined,
    department: ((formData.get('department') as string) || '').trim() || undefined,
    home_warehouse_id: ((formData.get('home_warehouse_id') as string) || '').trim() || undefined,
    make: ((formData.get('make') as string) || '').trim() || null,
    model: ((formData.get('model') as string) || '').trim() || null,
    year: yearRaw ? Number(yearRaw) || null : null,
    license_plate: ((formData.get('license_plate') as string) || '').trim() || null,
    vin: ((formData.get('vin') as string) || '').trim() || null,
    status: ((formData.get('status') as string) || '').trim() || null,
  };
}

export async function createTruckAction(formData: FormData) {
  await requireRole();
  const truck = await createTruck(readTruckForm(formData));
  revalidatePath('/trucks');
  redirect(`/trucks/${truck.id}`);
}

export async function updateTruckAction(truckId: string, formData: FormData) {
  await requireRole();
  await updateTruck(truckId, readTruckForm(formData));
  revalidatePath('/trucks');
  revalidatePath(`/trucks/${truckId}`);
  redirect(`/trucks/${truckId}`);
}

export async function retireTruckAction(truckId: string) {
  await requireRole();
  await updateTruck(truckId, { status: 'out_of_service' });
  revalidatePath('/trucks');
  revalidatePath(`/trucks/${truckId}`);
}

export async function reactivateTruckAction(truckId: string) {
  await requireRole();
  await updateTruck(truckId, { status: 'active' });
  revalidatePath('/trucks');
  revalidatePath(`/trucks/${truckId}`);
}

export async function assignTechToTruckAction(truckId: string, formData: FormData) {
  await requireRole();
  const userId = (formData.get('user_id') as string) || '';
  if (!userId) return;
  await updateUser(userId, { assigned_truck_id: truckId });
  revalidatePath(`/trucks/${truckId}`);
  revalidatePath('/users');
}

export async function unassignTechAction(truckId: string, userId: string) {
  await requireRole();
  await updateUser(userId, { assigned_truck_id: null });
  revalidatePath(`/trucks/${truckId}`);
  revalidatePath('/users');
}
