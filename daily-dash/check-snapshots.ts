import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSnapshots() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check December 2025 data - get ALL rows including department breakdowns
  const { data, error } = await supabase
    .from('trade_daily_snapshots')
    .select('*')
    .gte('snapshot_date', '2025-12-01')
    .lte('snapshot_date', '2025-12-31')
    .order('snapshot_date');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total rows in December:', data?.length || 0);

  // Count by type
  const aggregateRows = data?.filter(d => d.department === null) || [];
  const deptRows = data?.filter(d => d.department !== null) || [];

  console.log('Aggregate rows (department=null):', aggregateRows.length);
  console.log('Department breakdown rows:', deptRows.length);

  // Check for unique dates
  const dates = new Set(data?.map(d => d.snapshot_date));
  console.log('Unique dates:', dates.size);

  // Sum only aggregate rows
  let hvacTotal = 0;
  let plumbingTotal = 0;

  for (const snap of aggregateRows) {
    if (snap.trade === 'hvac') {
      hvacTotal += Number(snap.revenue) || 0;
    } else if (snap.trade === 'plumbing') {
      plumbingTotal += Number(snap.revenue) || 0;
    }
  }

  console.log('\nFrom aggregate rows only:');
  console.log('HVAC Total: $' + hvacTotal.toLocaleString());
  console.log('Plumbing Total: $' + plumbingTotal.toLocaleString());
  console.log('Combined: $' + (hvacTotal + plumbingTotal).toLocaleString());

  // Show first few rows to debug
  console.log('\nSample rows:');
  aggregateRows.slice(0, 5).forEach(r => {
    console.log(r.snapshot_date, r.trade, r.department, '$' + Number(r.revenue).toLocaleString());
  });
}

checkSnapshots().catch(console.error);
