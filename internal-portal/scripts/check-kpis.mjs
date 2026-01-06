import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dgnsvheokdubqmdlanua.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbnN2aGVva2R1YnFtZGxhbnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTExMDksImV4cCI6MjA4MzA4NzEwOX0.voa1LinO_Pk2UAH6-WURh1oZlCUvpbJzjS-430aCyTo'
);

async function main() {
  // Get departments
  const { data: depts } = await supabase
    .from('huddle_departments')
    .select('*')
    .order('display_order');

  console.log('\n=== DEPARTMENTS ===');
  depts?.forEach(d => console.log(`${d.display_order}. ${d.name} (${d.slug})`));

  // Get KPIs with department info
  const { data: kpis } = await supabase
    .from('huddle_kpis')
    .select('*, huddle_departments(name, slug)')
    .order('department_id')
    .order('display_order');

  console.log('\n=== KPIs ===');
  let lastDept = '';
  kpis?.forEach(k => {
    const deptName = k.huddle_departments?.name || 'Unknown';
    if (deptName !== lastDept) {
      console.log(`\n--- ${deptName} ---`);
      lastDept = deptName;
    }
    console.log(`  ${k.slug} | ${k.name} | source: ${k.data_source}`);
  });
}

main().catch(console.error);
