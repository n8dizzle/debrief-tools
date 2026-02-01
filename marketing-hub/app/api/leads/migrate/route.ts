import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getTradeFromCategoryId(categoryId: string | null): string | null {
  if (!categoryId) return null;
  const lower = categoryId.toLowerCase();
  if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling') || lower.includes('air_condition')) {
    return 'HVAC';
  }
  if (lower.includes('plumb') || lower.includes('drain') || lower.includes('water_heater')) {
    return 'Plumbing';
  }
  return 'Other';
}

function getLeadType(lsaLeadType: string | null): string {
  if (!lsaLeadType) return 'call';
  const lower = lsaLeadType.toLowerCase();
  if (lower.includes('phone') || lower.includes('call')) return 'call';
  if (lower.includes('message')) return 'message';
  if (lower.includes('booking')) return 'booking';
  return 'form';
}

/**
 * POST /api/leads/migrate
 * Migrate existing LSA leads to master_leads table
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (role !== 'owner' && !hasPermission(role, permissions, 'marketing_hub', 'can_sync_data')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    // Fetch all LSA leads
    const { data: lsaLeads, error: fetchError } = await supabase
      .from('lsa_leads')
      .select('*')
      .order('lead_created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch LSA leads: ${fetchError.message}`);
    }

    console.log(`[Migrate] Found ${lsaLeads?.length || 0} LSA leads to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const lead of lsaLeads || []) {
      // Check if already migrated
      const { data: existing } = await supabase
        .from('master_leads')
        .select('id')
        .eq('lsa_lead_id', lead.id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const trade = getTradeFromCategoryId(lead.category_id);
      const leadType = getLeadType(lead.lead_type);

      const masterLead = {
        lsa_lead_id: lead.id,
        original_source: 'lsa',
        original_source_id: lead.google_lead_id,
        primary_source: 'lsa',
        primary_source_detail: `Google LSA - ${trade || 'Unknown'}`,
        source_confidence: 100,
        phone: lead.consumer_phone_number || lead.phone_number,
        lead_type: leadType,
        trade,
        lead_status: lead.lead_charged ? 'qualified' : 'new',
        is_qualified: lead.lead_charged || false,
        is_booked: lead.lead_status === 'BOOKED',
        is_completed: false,
        lead_cost: null, // Will be calculated from lsa_daily_performance
        reconciliation_status: 'pending',
        is_duplicate: false,
        lead_created_at: lead.lead_created_at,
      };

      const { error: insertError } = await supabase
        .from('master_leads')
        .insert(masterLead);

      if (insertError) {
        console.error(`[Migrate] Error inserting lead ${lead.id}:`, insertError.message);
        errors++;
      } else {
        migrated++;
      }
    }

    console.log(`[Migrate] Complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        totalLsaLeads: lsaLeads?.length || 0,
        migrated,
        skipped,
        errors,
      },
    });
  } catch (error: any) {
    console.error('[Migrate] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/migrate
 * Get migration status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [lsaCount, masterCount, masterLsaCount] = await Promise.all([
      supabase.from('lsa_leads').select('id', { count: 'exact', head: true }),
      supabase.from('master_leads').select('id', { count: 'exact', head: true }),
      supabase.from('master_leads').select('id', { count: 'exact', head: true }).not('lsa_lead_id', 'is', null),
    ]);

    return NextResponse.json({
      lsaLeadsTotal: lsaCount.count || 0,
      masterLeadsTotal: masterCount.count || 0,
      lsaLeadsMigrated: masterLsaCount.count || 0,
      lsaLeadsPending: (lsaCount.count || 0) - (masterLsaCount.count || 0),
    });
  } catch (error: any) {
    console.error('Failed to get migration status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
