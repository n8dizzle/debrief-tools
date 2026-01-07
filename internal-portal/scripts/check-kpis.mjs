/**
 * Check if required KPIs exist in database
 * Run: node --env-file=.env.local scripts/check-kpis.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Get all departments to find the right one
  const { data: allDepts } = await supabase
    .from('huddle_departments')
    .select('id, slug, name');

  console.log('All departments:', allDepts?.map(d => `${d.slug} (${d.name})`).join(', '));

  // Find Christmas Overall department (where revenue KPIs live)
  const christmasDept = allDepts?.find(d => d.slug === 'christmas-overall');
  console.log('Christmas Overall department:', christmasDept);
  
  // Check existing KPIs
  const { data: kpis } = await supabase
    .from('huddle_kpis')
    .select('id, slug, name, data_source')
    .in('slug', ['revenue-completed', 'non-job-revenue', 'total-revenue']);
  
  console.log('\nExisting revenue KPIs:');
  kpis?.forEach(k => console.log(`  ${k.slug}: ${k.name} (${k.data_source})`));
  
  const existingSlugs = new Set(kpis?.map(k => k.slug) || []);
  
  // Add missing KPIs
  const missingKPIs = [];
  
  if (!existingSlugs.has('non-job-revenue') && christmasDept) {
    missingKPIs.push({
      slug: 'non-job-revenue',
      name: 'Non-Job Revenue',
      department_id: christmasDept.id,
      data_source: 'servicetitan',
      higher_is_better: true,
      is_active: true,
      display_order: 5,
    });
  }

  if (!existingSlugs.has('total-revenue') && christmasDept) {
    missingKPIs.push({
      slug: 'total-revenue',
      name: 'Total Revenue',
      department_id: christmasDept.id,
      data_source: 'servicetitan',
      higher_is_better: true,
      is_active: true,
      display_order: 6,
    });
  }
  
  if (missingKPIs.length > 0) {
    console.log('\nAdding missing KPIs...');
    const { data: inserted, error } = await supabase
      .from('huddle_kpis')
      .insert(missingKPIs)
      .select();
    
    if (error) {
      console.error('Error adding KPIs:', error);
    } else {
      console.log('Added KPIs:', inserted?.map(k => k.slug).join(', '));
    }
  } else {
    console.log('\nAll revenue KPIs exist!');
  }
}

main().catch(console.error);
