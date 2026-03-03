import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// One-time migration endpoint — safe to run multiple times (IF NOT EXISTS)
export async function POST() {
  const supabase = createServerSupabaseClient();
  const results: Record<string, string> = {};

  // Migration 1: Add service_titan_customer_id column to leads
  const { error: e1 } = await supabase.rpc('run_migration', {
    sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_titan_customer_id TEXT;',
  });
  results.service_titan_customer_id = e1 ? e1.message : 'OK';

  // Migration 2: Ensure in_queue column exists on comfort_advisors
  const { error: e2 } = await supabase.rpc('run_migration', {
    sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comfort_advisors' AND column_name = 'in_queue') THEN ALTER TABLE comfort_advisors ADD COLUMN in_queue BOOLEAN DEFAULT true; END IF; END $$;`,
  });
  results.in_queue_column = e2 ? e2.message : 'OK';

  // Migration 3: Fix any NULL in_queue values
  const { error: e3 } = await supabase.rpc('run_migration', {
    sql: `UPDATE comfort_advisors SET in_queue = true WHERE in_queue IS NULL;`,
  });
  results.in_queue_nulls = e3 ? e3.message : 'OK';

  // Migration 4: Update rotate_queue_positions to respect in_queue
  const { error: e4 } = await supabase.rpc('run_migration', {
    sql: `CREATE OR REPLACE FUNCTION rotate_queue_positions(p_advisor_id UUID, p_queue_type TEXT) RETURNS void AS $fn$ DECLARE v_max_position INT; BEGIN IF p_queue_type = 'tgl' THEN SELECT MAX(tgl_queue_position) INTO v_max_position FROM comfort_advisors WHERE active = true AND in_queue = true; UPDATE comfort_advisors SET tgl_queue_position = v_max_position WHERE id = p_advisor_id; UPDATE comfort_advisors SET tgl_queue_position = tgl_queue_position - 1 WHERE tgl_queue_position > 1 AND id != p_advisor_id AND active = true AND in_queue = true; ELSE SELECT MAX(marketed_queue_position) INTO v_max_position FROM comfort_advisors WHERE active = true AND in_queue = true; UPDATE comfort_advisors SET marketed_queue_position = v_max_position WHERE id = p_advisor_id; UPDATE comfort_advisors SET marketed_queue_position = marketed_queue_position - 1 WHERE marketed_queue_position > 1 AND id != p_advisor_id AND active = true AND in_queue = true; END IF; END; $fn$ LANGUAGE plpgsql;`,
  });
  results.rotate_function = e4 ? e4.message : 'OK';

  const allOk = Object.values(results).every(v => v === 'OK');
  return NextResponse.json({ success: allOk, results });
}
