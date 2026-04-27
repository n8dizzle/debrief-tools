'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkoutTool, checkinTool, sendToolForService } from '@/lib/services/tools';

async function requireSession() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) redirect('/login');
  return s;
}

export async function checkoutAction(toolId: string, formData: FormData) {
  const s = await requireSession();
  await checkoutTool(
    toolId,
    {
      technician_id: String(formData.get('technician_id') ?? s.user.id),
      truck_id: (formData.get('truck_id') as string) || null,
      st_job_id: (formData.get('st_job_id') as string) || null,
      condition: (formData.get('condition') as string) || null,
      notes: (formData.get('notes') as string) || null,
    },
    s.user.id,
  );
  revalidatePath(`/tools/${toolId}`);
}

export async function checkinAction(toolId: string, formData: FormData) {
  const s = await requireSession();
  await checkinTool(
    toolId,
    {
      condition: (formData.get('condition') as string) || null,
      notes: (formData.get('notes') as string) || null,
    },
    s.user.id,
  );
  revalidatePath(`/tools/${toolId}`);
}

export async function sendForServiceAction(toolId: string, formData: FormData) {
  const s = await requireSession();
  await sendToolForService(toolId, { notes: (formData.get('notes') as string) || null }, s.user.id);
  revalidatePath(`/tools/${toolId}`);
}
