/**
 * Batch geocode new_customers using Google Maps Geocoding API.
 * Usage: npx tsx scripts/geocode-customers.ts
 */

const GOOGLE_MAPS_API_KEY = 'AIzaSyDq5XNNwiVUfqea_3PSl7SZIWzmAhN79H8';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_ID = 'dgnsvheokdubqmdlanua';

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

async function main() {
  // Use Supabase Management API via access token
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  async function executeSql(query: string): Promise<any[]> {
    // Use the REST API with service role key instead
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`;
    // Actually, let's use the PostgREST API directly
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('No SUPABASE_SERVICE_ROLE_KEY');
    return [];
  }

  // Simpler approach: read JSON, geocode, write SQL updates
  const fs = await import('fs');
  const jsonPath = resolve(__dirname, 'seed-customers.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`Geocoding ${data.length} customers...`);

  const updates: { st_customer_id: string; lat: number; lng: number }[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const customer = data[i];
    if (!customer.full_address) {
      failed++;
      continue;
    }

    try {
      const encoded = encodeURIComponent(customer.full_address);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await res.json();

      if (json.status === 'OK' && json.results.length > 0) {
        const { lat, lng } = json.results[0].geometry.location;
        updates.push({ st_customer_id: customer.st_customer_id, lat, lng });
        success++;
      } else {
        failed++;
        if (json.status === 'OVER_QUERY_LIMIT') {
          console.log('Rate limited, waiting 2s...');
          await new Promise(r => setTimeout(r, 2000));
          i--; // retry
          continue;
        }
      }

      if (i > 0 && i % 100 === 0) {
        console.log(`  ${i}/${data.length} processed (${success} ok, ${failed} failed)`);
      }

      // Small delay to stay under rate limits
      if (i % 50 === 0) await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
    }
  }

  console.log(`\nGeocoded: ${success}, Failed: ${failed}`);

  // Write results as SQL update file
  const sqlLines = updates.map(u =>
    `UPDATE new_customers SET lat = ${u.lat}, lng = ${u.lng}, geocoded_at = NOW() WHERE st_customer_id = '${u.st_customer_id}';`
  );

  // Split into batch files of 100 updates each
  const batchSize = 100;
  for (let i = 0; i < sqlLines.length; i += batchSize) {
    const batch = sqlLines.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize);
    fs.writeFileSync(
      resolve(__dirname, `geocode-update-${batchNum}.sql`),
      batch.join('\n')
    );
  }

  console.log(`Written ${Math.ceil(sqlLines.length / batchSize)} SQL update batch files`);
}

main().catch(console.error);
