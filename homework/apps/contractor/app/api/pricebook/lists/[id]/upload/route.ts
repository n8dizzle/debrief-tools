import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

async function getContractorId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

// POST /api/pricebook/lists/[id]/upload - Upload a PDF file for a supplier list
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Verify the supplier list exists and belongs to this contractor
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('id, contractor_id')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('POST /api/pricebook/lists/[id]/upload find error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Upload a PDF file with field name "file".' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Max file size: 20MB
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 });
    }

    const fileName = file.name;
    const storagePath = `${contractorId}/${list.id}/${fileName}`;

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('pricebook-uploads')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('POST /api/pricebook/lists/[id]/upload storage error:', uploadError);
      return NextResponse.json({ error: `File upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('pricebook-uploads')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Update the supplier list record with file info
    const { data: updatedList, error: updateError } = await supabase
      .from('pricebook_supplier_lists')
      .update({
        file_url: fileUrl,
        file_name: fileName,
      })
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .select()
      .single();

    if (updateError) {
      console.error('POST /api/pricebook/lists/[id]/upload update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ list: updatedList });
  } catch (err) {
    console.error('POST /api/pricebook/lists/[id]/upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
