import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // call, email, text, etc.
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const ownerId = searchParams.get('ownerId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getServerSupabase();

    // Build query for notes with invoice info
    let query = supabase
      .from('ar_collection_notes')
      .select(`
        *,
        ar_invoices!inner(
          id,
          invoice_number,
          customer_name,
          balance
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('note_type', type);
    }

    if (dateFrom) {
      query = query.gte('note_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('note_date', dateTo);
    }

    const { data: notes, error, count } = await query;

    if (error) {
      console.error('Error fetching activity:', error);
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }

    // If ownerId filter is set, we need to filter by tracking owner
    // This requires a separate query approach
    let filteredNotes = notes || [];

    if (ownerId && filteredNotes.length > 0) {
      const invoiceIds = filteredNotes.map(n => n.invoice_id).filter(Boolean);

      const { data: trackingData } = await supabase
        .from('ar_invoice_tracking')
        .select('invoice_id')
        .in('invoice_id', invoiceIds)
        .eq('owner_id', ownerId);

      const ownerInvoiceIds = new Set(trackingData?.map(t => t.invoice_id) || []);
      filteredNotes = filteredNotes.filter(n => ownerInvoiceIds.has(n.invoice_id));
    }

    // Transform notes to include invoice info in a cleaner format
    const activities = filteredNotes.map(note => ({
      id: note.id,
      invoice_id: note.invoice_id,
      customer_id: note.customer_id,
      note_date: note.note_date,
      author_initials: note.author_initials,
      content: note.content,
      note_type: note.note_type,
      contact_result: note.contact_result,
      spoke_with: note.spoke_with,
      promised_amount: note.promised_amount,
      promised_date: note.promised_date,
      created_at: note.created_at,
      invoice_number: note.ar_invoices?.invoice_number,
      customer_name: note.ar_invoices?.customer_name,
      balance: note.ar_invoices?.balance,
    }));

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('ar_collection_notes')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      activities,
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
