import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { sendUploadNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    // Accept multiple files via 'files' or single file via 'file'
    let files: File[] = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      const single = formData.get('file') as File | null;
      if (single) files = [single];
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Only images allowed.' }, { status: 400 });
      }
    }

    const supabase = getServerSupabase();
    const docId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    // Upload all files to storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'jpg';
      const suffix = files.length > 1 ? `_p${i + 1}` : '';
      const imagePath = `${session.user.id}/${docId}${suffix}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('doc-dispatch')
        .upload(imagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Clean up any already-uploaded files
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('doc-dispatch').remove(uploadedPaths);
        }
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }
      uploadedPaths.push(imagePath);
    }

    // Create document record (image_path = page 1)
    const { data: doc, error: dbError } = await supabase
      .from('dd_documents')
      .insert({
        id: docId,
        uploaded_by: session.user.id,
        image_path: uploadedPaths[0],
        status: 'new',
        priority: 'medium',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      await supabase.storage.from('doc-dispatch').remove(uploadedPaths);
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
    }

    // Insert page records
    const pageRows = uploadedPaths.map((path, i) => ({
      document_id: docId,
      image_path: path,
      page_number: i + 1,
    }));

    const { error: pagesError } = await supabase
      .from('dd_document_pages')
      .insert(pageRows);

    if (pagesError) {
      console.error('Pages insert error:', pagesError);
      // Non-fatal — doc still exists
    }

    // Send upload notification (non-blocking)
    sendUploadNotification({
      documentId: docId,
      uploaderName: session.user.name || '',
      uploaderEmail: session.user.email || '',
      pageCount: files.length,
      source: 'web',
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assigned_to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getServerSupabase();

    let query = supabase
      .from('dd_documents')
      .select(`
        *,
        uploader:portal_users!dd_documents_uploaded_by_fkey(name, email),
        owner:portal_users!dd_documents_assigned_to_fkey(id, name, email),
        action_items:dd_action_items(id, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'incomplete') {
      query = query.in('status', ['new', 'in_progress']);
    } else if (status) {
      query = query.eq('status', status);
    }
    if (type) query = query.eq('document_type', type);
    if (priority) query = query.eq('priority', priority);
    if (assignedTo === 'unassigned') {
      query = query.is('assigned_to', null);
    } else if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (search) query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,document_type.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ documents: data || [], total: count || 0 });
  } catch (err) {
    console.error('List error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
