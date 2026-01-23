import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getInitials, getTodayDateString } from '@/lib/ar-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = params;
    const body = await request.json();
    const { content, note_type = 'call', contact_result, spoke_with, promised_amount, promised_date } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Get user initials
    const authorInitials = getInitials(session.user.name || session.user.email || 'XX');

    // Get the invoice to get the customer_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('ar_invoices')
      .select('customer_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Create the note
    const { data: note, error: noteError } = await supabase
      .from('ar_collection_notes')
      .insert({
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        note_date: getTodayDateString(),
        author_initials: authorInitials,
        content: content.trim(),
        note_type,
        contact_result,
        spoke_with,
        promised_amount,
        promised_date,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (noteError) {
      console.error('Error creating note:', noteError);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Note creation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = params;
    const supabase = getServerSupabase();

    const { data: notes, error } = await supabase
      .from('ar_collection_notes')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error('Notes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
