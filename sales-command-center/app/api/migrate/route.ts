import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// One-time migration endpoint — safe to run multiple times (IF NOT EXISTS)
export async function POST() {
  const supabase = createServerSupabaseClient();

  // Add service_titan_customer_id column to leads table
  const { error } = await supabase.rpc('run_migration', {
    sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_titan_customer_id TEXT;',
  });

  if (error) {
    // If rpc doesn't exist, try direct approach via a raw query workaround
    // Attempt to update a non-existent field to detect column existence
    const { error: checkError } = await supabase
      .from('leads')
      .select('service_titan_customer_id')
      .limit(1);

    if (checkError && checkError.message.includes('service_titan_customer_id')) {
      return NextResponse.json({
        success: false,
        message: 'Column does not exist. Please run this SQL in the Supabase dashboard:\n\nALTER TABLE leads ADD COLUMN IF NOT EXISTS service_titan_customer_id TEXT;',
        sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_titan_customer_id TEXT;',
      });
    }

    return NextResponse.json({ success: true, message: 'Column already exists' });
  }

  return NextResponse.json({ success: true, message: 'Migration applied' });
}
