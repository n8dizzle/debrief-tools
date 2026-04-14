import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/jobs/[id]/invoice — upload a subcontractor invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, and PNG files are allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  // Get job and clean up old file if exists
  const { data: job } = await supabase
    .from('ap_install_jobs')
    .select('id, invoice_storage_path')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.invoice_storage_path) {
    await supabase.storage.from('ap-documents').remove([job.invoice_storage_path]);
  }

  // Upload
  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `invoices/${id}/invoice-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('ap-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('ap-documents')
    .getPublicUrl(storagePath);

  await supabase
    .from('ap_install_jobs')
    .update({
      invoice_file_url: urlData.publicUrl,
      invoice_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Log activity
  await supabase.from('ap_activity_log').insert({
    job_id: id,
    action: 'invoice_uploaded',
    description: `Invoice uploaded: ${file.name}`,
    performed_by: session.user.id,
  });

  return NextResponse.json({ url: urlData.publicUrl });
}

/**
 * DELETE /api/jobs/[id]/invoice — remove uploaded invoice
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: job } = await supabase
    .from('ap_install_jobs')
    .select('id, invoice_storage_path')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.invoice_storage_path) {
    await supabase.storage.from('ap-documents').remove([job.invoice_storage_path]);
  }

  await supabase
    .from('ap_install_jobs')
    .update({
      invoice_file_url: null,
      invoice_storage_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  await supabase.from('ap_activity_log').insert({
    job_id: id,
    action: 'invoice_removed',
    description: 'Invoice file removed',
    performed_by: session.user.id,
  });

  return NextResponse.json({ success: true });
}
