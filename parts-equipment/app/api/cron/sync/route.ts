import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { isValidCronRequest } from '@/lib/pe-utils';

export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.parts_equipment?.can_sync_data) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();

  try {
    // ServiceTitan sync: pull jobs tagged "Parts Requested"
    // ST credentials are already in env from other apps
    const tenantId = process.env.ST_TENANT_ID || process.env.SERVICETITAN_TENANT_ID;
    const clientId = process.env.ST_CLIENT_ID || process.env.SERVICETITAN_CLIENT_ID;
    const clientSecret = process.env.ST_CLIENT_SECRET || process.env.SERVICETITAN_CLIENT_SECRET;
    const appKey = process.env.ST_APP_KEY || process.env.SERVICETITAN_APP_KEY;

    if (!tenantId || !clientId || !clientSecret) {
      // Log that sync ran but ST is not yet configured
      await supabase.from('po_audit_log').insert({
        event_type: 'sync',
        action: 'Sync skipped — ServiceTitan not configured',
        performed_by: 'cron',
      });
      return NextResponse.json({ success: true, message: 'ST not configured — skipped' });
    }

    // Get ST access token
    const tokenRes = await fetch('https://auth.servicetitan.io/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`ST auth failed: ${tokenRes.status}`);
    }

    const { access_token } = await tokenRes.json();

    // Fetch all tag types to find "Parts Requested" tag ID
    const tagsRes = await fetch(
      `https://api.servicetitan.io/settings/v2/tenant/${tenantId}/tag-types?pageSize=200`,
      { headers: { Authorization: `Bearer ${access_token}`, 'ST-App-Key': appKey || '' } }
    );

    const tagsData = tagsRes.ok ? await tagsRes.json() : { data: [] };
    const partsRequestedTag = tagsData.data?.find(
      (t: any) => t.name?.toLowerCase().includes('parts requested')
    );

    if (!partsRequestedTag) {
      await supabase.from('po_audit_log').insert({
        event_type: 'sync',
        action: 'Sync skipped — "Parts Requested" tag not found in ServiceTitan',
        performed_by: 'cron',
      });
      return NextResponse.json({ success: true, message: 'Parts Requested tag not found' });
    }

    // Fetch jobs with Parts Requested tag
    const jobsRes = await fetch(
      `https://api.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs?tagTypeIds=${partsRequestedTag.id}&status=Scheduled,Unscheduled&pageSize=200`,
      { headers: { Authorization: `Bearer ${access_token}`, 'ST-App-Key': appKey || '' } }
    );

    if (!jobsRes.ok) throw new Error(`ST jobs fetch failed: ${jobsRes.status}`);

    const jobsData = await jobsRes.json();
    const jobs = jobsData.data || [];

    let created = 0;
    let skipped = 0;

    for (const job of jobs) {
      const jobId = String(job.number || job.id);
      const stUrl = `https://go.servicetitan.com/#/Job/Index/${job.id}`;

      const { data: existing } = await supabase
        .from('po_orders')
        .select('job_id, status')
        .eq('job_id', jobId)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      await supabase.from('po_orders').insert({
        job_id: jobId,
        st_url: stUrl,
        customer_name: job.customer?.name || null,
        technician: job.technician?.name || null,
        job_type: job.type?.name || 'Parts',
        date_added: job.createdOn ? job.createdOn.split('T')[0] : null,
        owner: 'CXR',
        location: 'Place Order',
        status: 'open',
      });
      created++;
    }

    await supabase.from('po_audit_log').insert({
      event_type: 'sync',
      action: `ST sync complete — ${created} new, ${skipped} existing`,
      performed_by: 'cron',
    });

    return NextResponse.json({ success: true, created, skipped, total: jobs.length });
  } catch (err: any) {
    await supabase.from('po_audit_log').insert({
      event_type: 'sync',
      action: `Sync error: ${err.message}`,
      performed_by: 'cron',
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
