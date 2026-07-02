import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasRecallPermission } from '@/lib/qc-recalls';

// GET /api/recalls/queue?startDate=&endDate=&trade=&status=
// Filterable list of recalls for the Recall Queue, each with its investigation status.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const trade = searchParams.get('trade') || 'all';
  const statusFilter = searchParams.get('status') || 'all'; // open|investigating|resolved|none|all
  if (!startDate || !endDate) return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });

  const supabase = getServerSupabase();

  let q = supabase
    .from('sd_recalls_caused')
    .select('st_recall_job_id, st_original_job_id, caused_by_tech_id, recall_created_on, days_to_recall, trade, business_unit_name, customer_name, equipment_id')
    .or('is_service_bu.is.null,is_service_bu.eq.true') // service technicians only (audience scope)
    .gte('recall_created_on', startDate)
    .lte('recall_created_on', endDate)
    .order('recall_created_on', { ascending: false })
    .limit(1000);
  if (trade === 'hvac' || trade === 'plumbing') q = q.eq('trade', trade);
  const { data: recalls } = await q;
  const rows = recalls || [];

  const { data: techs } = await supabase.from('sd_technicians').select('st_technician_id, name');
  const techName = new Map<number, string>((techs || []).map(t => [t.st_technician_id, t.name]));

  // Investigation status per recall
  const jobIds = rows.map(r => r.st_recall_job_id);
  const invStatus = new Map<number, string>();
  if (jobIds.length > 0) {
    const { data: invs } = await supabase
      .from('sd_recall_investigations')
      .select('st_recall_job_id, status')
      .in('st_recall_job_id', jobIds);
    for (const i of (invs || [])) invStatus.set(i.st_recall_job_id, i.status);
  }

  let items = rows.map(r => ({
    st_recall_job_id: r.st_recall_job_id,
    st_original_job_id: r.st_original_job_id,
    caused_by_tech_id: r.caused_by_tech_id ?? null,
    tech_name: r.caused_by_tech_id != null ? (techName.get(r.caused_by_tech_id) || `Tech ${r.caused_by_tech_id}`) : '—',
    recall_created_on: r.recall_created_on,
    days_to_recall: r.days_to_recall,
    trade: r.trade,
    business_unit_name: r.business_unit_name,
    customer_name: r.customer_name,
    has_equipment: r.equipment_id != null,
    investigation_status: invStatus.get(r.st_recall_job_id) || 'none',
  }));

  if (statusFilter !== 'all') items = items.filter(i => i.investigation_status === statusFilter);

  return NextResponse.json({ recalls: items }, { headers: { 'Cache-Control': 'no-store' } });
}
