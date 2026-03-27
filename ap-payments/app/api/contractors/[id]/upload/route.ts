import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_DOC_TYPES = ['coi', 'w9', 'agreement'] as const;
type DocType = (typeof VALID_DOC_TYPES)[number];

const FILE_URL_COLUMNS: Record<DocType, { url: string; path: string }> = {
  coi: { url: 'coi_file_url', path: 'coi_storage_path' },
  w9: { url: 'w9_file_url', path: 'w9_storage_path' },
  agreement: { url: 'agreement_file_url', path: 'agreement_storage_path' },
};

const BOOLEAN_COLUMNS: Record<DocType, string> = {
  coi: 'has_coi',
  w9: 'has_w9',
  agreement: 'has_signed_agreement',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const docType = formData.get('docType') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!docType || !VALID_DOC_TYPES.includes(docType as DocType)) {
    return NextResponse.json({ error: 'Invalid docType. Must be coi, w9, or agreement' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, and PNG files are allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const dt = docType as DocType;
  const cols = FILE_URL_COLUMNS[dt];

  // Check contractor exists and get current file path for cleanup
  const { data: contractor, error: fetchError } = await supabase
    .from('ap_contractors')
    .select(`id, ${cols.path}`)
    .eq('id', id)
    .single();

  if (fetchError || !contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  // Delete old file if it exists
  const oldPath = contractor[cols.path as keyof typeof contractor] as string | null;
  if (oldPath) {
    await supabase.storage.from('ap-documents').remove([oldPath]);
  }

  // Upload new file
  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `contractors/${id}/${dt}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('ap-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('ap-documents')
    .getPublicUrl(storagePath);

  // Update contractor record
  const { error: updateError } = await supabase
    .from('ap_contractors')
    .update({
      [cols.url]: urlData.publicUrl,
      [cols.path]: storagePath,
      [BOOLEAN_COLUMNS[dt]]: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: urlData.publicUrl, storagePath });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { docType } = await request.json();

  if (!docType || !VALID_DOC_TYPES.includes(docType as DocType)) {
    return NextResponse.json({ error: 'Invalid docType' }, { status: 400 });
  }

  const dt = docType as DocType;
  const cols = FILE_URL_COLUMNS[dt];
  const supabase = getServerSupabase();

  // Get current storage path
  const { data: contractor } = await supabase
    .from('ap_contractors')
    .select(`id, ${cols.path}`)
    .eq('id', id)
    .single();

  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  // Delete from storage
  const storagePath = contractor[cols.path as keyof typeof contractor] as string | null;
  if (storagePath) {
    await supabase.storage.from('ap-documents').remove([storagePath]);
  }

  // Clear DB fields
  const { error } = await supabase
    .from('ap_contractors')
    .update({
      [cols.url]: null,
      [cols.path]: null,
      [BOOLEAN_COLUMNS[dt]]: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
