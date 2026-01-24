import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient } from './lib/servicetitan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function backfillDecember() {
  console.log('Backfilling December 2025 trade data...\n');

  if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set!');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const stClient = getServiceTitanClient();

  if (!stClient.isConfigured()) {
    console.log('ServiceTitan not configured');
    return;
  }

  // All December 2025 dates
  const dates: string[] = [];
  for (let d = 1; d <= 31; d++) {
    dates.push('2025-12-' + String(d).padStart(2, '0'));
  }

  let successCount = 0;
  let errorCount = 0;

  for (const syncDate of dates) {
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

      const { error: upsertError } = await supabase
        .from('trade_daily_snapshots')
        .upsert(rows, { onConflict: 'snapshot_date,trade,department' });

      if (upsertError) {
        console.log('✗ ' + syncDate + ': ' + upsertError.message);
        errorCount++;
      } else {
        const hvacRev = (metrics.hvac.revenue / 1000).toFixed(1);
        const plumbRev = (metrics.plumbing.revenue / 1000).toFixed(1);
        console.log('✓ ' + syncDate + ': HVAC $' + hvacRev + 'K, Plumbing $' + plumbRev + 'K');
        successCount++;
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.log('✗ ' + syncDate + ': ' + errorMsg);
      errorCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log('Success: ' + successCount);
  console.log('Errors: ' + errorCount);
}

backfillDecember().catch(console.error);
