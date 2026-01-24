import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient } from './lib/servicetitan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixDecember() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const stClient = getServiceTitanClient();

  // Step 1: Delete all December 2025 data
  console.log('Deleting existing December 2025 data...');
  const { error: deleteError } = await supabase
    .from('trade_daily_snapshots')
    .delete()
    .gte('snapshot_date', '2025-12-01')
    .lte('snapshot_date', '2025-12-31');

  if (deleteError) {
    console.error('Delete error:', deleteError);
    return;
  }
  console.log('Deleted existing data.\n');

  // Step 2: Re-insert December data
  console.log('Re-inserting December 2025 data...\n');

  for (let d = 1; d <= 31; d++) {
    const syncDate = '2025-12-' + String(d).padStart(2, '0');

    try {
      const metrics = await stClient.getTradeMetrics(syncDate);

      const rows = [
        {
          snapshot_date: syncDate,
          trade: 'hvac',
          department: null,
          revenue: metrics.hvac.revenue,
          completed_revenue: metrics.hvac.completedRevenue,
          non_job_revenue: metrics.hvac.nonJobRevenue,
          adj_revenue: metrics.hvac.adjRevenue,
        },
        {
          snapshot_date: syncDate,
          trade: 'hvac',
          department: 'install',
          revenue: metrics.hvac.departments?.install?.revenue || 0,
          completed_revenue: metrics.hvac.departments?.install?.completedRevenue || 0,
          non_job_revenue: metrics.hvac.departments?.install?.nonJobRevenue || 0,
          adj_revenue: metrics.hvac.departments?.install?.adjRevenue || 0,
        },
        {
          snapshot_date: syncDate,
          trade: 'hvac',
          department: 'service',
          revenue: metrics.hvac.departments?.service?.revenue || 0,
          completed_revenue: metrics.hvac.departments?.service?.completedRevenue || 0,
          non_job_revenue: metrics.hvac.departments?.service?.nonJobRevenue || 0,
          adj_revenue: metrics.hvac.departments?.service?.adjRevenue || 0,
        },
        {
          snapshot_date: syncDate,
          trade: 'hvac',
          department: 'maintenance',
          revenue: metrics.hvac.departments?.maintenance?.revenue || 0,
          completed_revenue: metrics.hvac.departments?.maintenance?.completedRevenue || 0,
          non_job_revenue: metrics.hvac.departments?.maintenance?.nonJobRevenue || 0,
          adj_revenue: metrics.hvac.departments?.maintenance?.adjRevenue || 0,
        },
        {
          snapshot_date: syncDate,
          trade: 'plumbing',
          department: null,
          revenue: metrics.plumbing.revenue,
          completed_revenue: metrics.plumbing.completedRevenue,
          non_job_revenue: metrics.plumbing.nonJobRevenue,
          adj_revenue: metrics.plumbing.adjRevenue,
        },
      ];

      // Use insert instead of upsert
      const { error: insertError } = await supabase
        .from('trade_daily_snapshots')
        .insert(rows);

      if (insertError) {
        console.log('✗ ' + syncDate + ': ' + insertError.message);
      } else {
        const hvacRev = (metrics.hvac.revenue / 1000).toFixed(1);
        const plumbRev = (metrics.plumbing.revenue / 1000).toFixed(1);
        console.log('✓ ' + syncDate + ': HVAC $' + hvacRev + 'K, Plumbing $' + plumbRev + 'K');
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log('✗ ' + syncDate + ': ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // Step 3: Verify totals
  console.log('\n=== Verifying totals ===');
  const { data: verifyData } = await supabase
    .from('trade_daily_snapshots')
    .select('trade, revenue')
    .gte('snapshot_date', '2025-12-01')
    .lte('snapshot_date', '2025-12-31')
    .is('department', null);

  let hvacTotal = 0;
  let plumbingTotal = 0;
  for (const snap of verifyData || []) {
    if (snap.trade === 'hvac') hvacTotal += Number(snap.revenue) || 0;
    else if (snap.trade === 'plumbing') plumbingTotal += Number(snap.revenue) || 0;
  }

  console.log('HVAC: $' + hvacTotal.toLocaleString());
  console.log('Plumbing: $' + plumbingTotal.toLocaleString());
  console.log('Total: $' + (hvacTotal + plumbingTotal).toLocaleString());
}

fixDecember().catch(console.error);
