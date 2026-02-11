import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/deposits
 * Fetch deposit reconciliation records with summary stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const supabase = getServerSupabase();

    // Build query for reconciliation records
    let query = supabase
      .from('ar_payment_reconciliation')
      .select(`
        *,
        invoice:ar_invoices(
          invoice_number,
          st_invoice_id
        )
      `)
      .order('payment_date', { ascending: false })
      .limit(200);

    // Filter by status
    if (status === 'undeposited') {
      // Payments in QB Undeposited Funds (has QB match, not deposited yet)
      query = query.eq('is_deposited', false).not('qb_payment_id', 'is', null);
    } else if (status === 'needs_tracking') {
      // ST payments with no QB match - technician collected but not turned in
      query = query.eq('match_status', 'st_only');
    } else if (status === 'matched') {
      query = query.in('match_status', ['matched', 'auto_matched', 'manual_matched']);
    } else if (status === 'unmatched') {
      query = query.in('match_status', ['unmatched', 'pending_review']);
    } else if (status === 'discrepancy') {
      query = query.eq('match_status', 'discrepancy');
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('payment_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('payment_date', dateTo);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('[Deposits API] Error fetching records:', error);
      throw error;
    }

    // Calculate summary stats
    const today = new Date().toISOString().split('T')[0];

    // Get all records for summary calculation (not just filtered)
    const { data: allRecords } = await supabase
      .from('ar_payment_reconciliation')
      .select('amount, match_status, is_deposited, payment_type, matched_at, qb_payment_id')
      .order('payment_date', { ascending: false });

    const summary = {
      totalUndeposited: 0,
      undepositedCount: 0,
      needsTracking: 0,
      needsTrackingCount: 0,
      pendingMatch: 0,
      pendingMatchCount: 0,
      matchedToday: 0,
      matchedTodayCount: 0,
      byType: {
        cash: 0,
        check: 0,
        card: 0,
        other: 0,
      },
    };

    if (allRecords) {
      for (const record of allRecords) {
        // Needs Tracking - ST payment with no QB match (technician collected but not turned in)
        if (record.match_status === 'st_only') {
          summary.needsTracking += record.amount;
          summary.needsTrackingCount++;

          // Also count by payment type
          if (record.payment_type) {
            const type = record.payment_type.toLowerCase();
            if (type.includes('cash')) {
              summary.byType.cash += record.amount;
            } else if (type.includes('check')) {
              summary.byType.check += record.amount;
            } else if (type.includes('card') || type.includes('credit') || type.includes('debit')) {
              summary.byType.card += record.amount;
            } else {
              summary.byType.other += record.amount;
            }
          }
          continue;
        }

        // Undeposited (in QB Undeposited Funds but has a QB payment)
        if (!record.is_deposited && record.qb_payment_id) {
          summary.totalUndeposited += record.amount;
          summary.undepositedCount++;
        }

        // Pending match (QB payment without ST match)
        if (['unmatched', 'pending_review'].includes(record.match_status)) {
          summary.pendingMatch += record.amount;
          summary.pendingMatchCount++;
        }

        // Matched today
        if (record.matched_at) {
          const matchedDate = record.matched_at.split('T')[0];
          if (matchedDate === today && ['matched', 'auto_matched', 'manual_matched'].includes(record.match_status)) {
            summary.matchedToday += record.amount;
            summary.matchedTodayCount++;
          }
        }
      }
    }

    return NextResponse.json({
      records: records || [],
      summary,
    });
  } catch (error) {
    console.error('[Deposits API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch deposits' },
      { status: 500 }
    );
  }
}
