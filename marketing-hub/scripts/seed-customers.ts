/**
 * Seed new_customers table from exported JSON.
 * Usage: npx tsx scripts/seed-customers.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CustomerRow {
  st_customer_id: string;
  customer_name: string;
  created_on: string | null;
  customer_type: string;
  member_status: string;
  original_campaign: string | null;
  created_by: string | null;
  city: string | null;
  full_address: string | null;
  completed_revenue: number;
  total_sales: number;
  lifetime_revenue: number;
  completed_jobs: number;
  last_job_completed: string | null;
}

async function main() {
  const jsonPath = resolve(__dirname, 'seed-customers.json');
  const data: CustomerRow[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded ${data.length} customers from JSON`);

  // Upsert in batches of 500
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase
      .from('new_customers')
      .upsert(batch, { onConflict: 'st_customer_id' });

    if (error) {
      console.error(`Batch ${i / batchSize + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${data.length}`);
    }
  }

  console.log('Done! Seeded', inserted, 'customers');
}

main().catch(console.error);
