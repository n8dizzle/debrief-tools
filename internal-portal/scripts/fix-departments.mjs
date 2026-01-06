import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dgnsvheokdubqmdlanua.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbnN2aGVva2R1YnFtZGxhbnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTExMDksImV4cCI6MjA4MzA4NzEwOX0.voa1LinO_Pk2UAH6-WURh1oZlCUvpbJzjS-430aCyTo'
);

async function main() {
  console.log('Updating department order...\n');

  // New order:
  // 1. Christmas Pacing (visual at top)
  // 2. Christmas (Overall)
  // 3. HVAC Overall (new)
  // 4. HVAC Install
  // 5. HVAC Service
  // 6. HVAC Maintenance (new)
  // 7. Plumbing
  // 8. Call Center
  // 9. Marketing
  // 10. Finance
  // 11. Warehouse

  const updates = [
    { slug: 'christmas-pacing', display_order: 1 },
    { slug: 'christmas-overall', display_order: 2 },
    { slug: 'hvac-install', display_order: 4 },
    { slug: 'hvac-service', display_order: 5 },
    { slug: 'plumbing', display_order: 7 },
    { slug: 'call-center', display_order: 8 },
    { slug: 'marketing', display_order: 9 },
    { slug: 'finance', display_order: 10 },
    { slug: 'warehouse', display_order: 11 },
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from('huddle_departments')
      .update({ display_order: update.display_order })
      .eq('slug', update.slug);

    if (error) {
      console.log(`Error updating ${update.slug}:`, error.message);
    } else {
      console.log(`Updated ${update.slug} -> order ${update.display_order}`);
    }
  }

  // Add HVAC Overall if it doesn't exist
  const { data: hvacOverall } = await supabase
    .from('huddle_departments')
    .select('*')
    .eq('slug', 'hvac-overall')
    .single();

  if (!hvacOverall) {
    console.log('\nCreating HVAC Overall department...');
    const { error } = await supabase.from('huddle_departments').insert({
      name: 'HVAC Overall',
      slug: 'hvac-overall',
      icon: 'chart-bar',
      display_order: 3,
      is_active: true,
    });
    if (error) {
      console.log('Error creating HVAC Overall:', error.message);
    } else {
      console.log('Created HVAC Overall');
    }
  } else {
    // Update order
    await supabase
      .from('huddle_departments')
      .update({ display_order: 3 })
      .eq('slug', 'hvac-overall');
    console.log('Updated hvac-overall -> order 3');
  }

  // Add HVAC Maintenance if it doesn't exist
  const { data: hvacMaint } = await supabase
    .from('huddle_departments')
    .select('*')
    .eq('slug', 'hvac-maintenance')
    .single();

  if (!hvacMaint) {
    console.log('\nCreating HVAC Maintenance department...');
    const { error } = await supabase.from('huddle_departments').insert({
      name: 'HVAC Maintenance',
      slug: 'hvac-maintenance',
      icon: 'wrench',
      display_order: 6,
      is_active: true,
    });
    if (error) {
      console.log('Error creating HVAC Maintenance:', error.message);
    } else {
      console.log('Created HVAC Maintenance');
    }
  } else {
    await supabase
      .from('huddle_departments')
      .update({ display_order: 6 })
      .eq('slug', 'hvac-maintenance');
    console.log('Updated hvac-maintenance -> order 6');
  }

  // Verify final order
  console.log('\n=== FINAL DEPARTMENT ORDER ===');
  const { data: depts } = await supabase
    .from('huddle_departments')
    .select('*')
    .order('display_order');

  depts?.forEach(d => console.log(`${d.display_order}. ${d.name} (${d.slug})`));
}

main().catch(console.error);
