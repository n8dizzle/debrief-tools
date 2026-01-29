/**
 * One-time import script: Import GBP Performance data from CSV
 *
 * This script reads historical GBP performance data from a CSV file
 * (exported from Google Sheets) and imports it into gbp_insights_cache.
 *
 * Prerequisites:
 * - Export the Google Sheet as CSV and save to scripts/gbp-performance-data.csv
 * - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * Run with: npx tsx scripts/import-gbp-from-sheets.ts
 *
 * Or with a custom CSV path:
 *   npx tsx scripts/import-gbp-from-sheets.ts /path/to/data.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const DEFAULT_CSV_PATH = path.join(__dirname, 'gbp-performance-data.csv');

interface SheetRow {
  date: string;
  location: string;
  mapsDesktop: number;
  mapsMobile: number;
  searchDesktop: number;
  searchMobile: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
}

interface LocationMap {
  [name: string]: string; // location name -> location_id
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  console.log('=== GBP Insights Import from CSV ===\n');

  // Get CSV path from command line or use default
  const csvPath = process.argv[2] || DEFAULT_CSV_PATH;

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Check if CSV file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    console.error('\nTo import data:');
    console.error('1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1SEmiZ5izCQNXxhRaYn1CRnZAAQtPJHZTS1GTtv4FiU8');
    console.error('2. Go to File > Download > Comma Separated Values (.csv)');
    console.error(`3. Save as: ${DEFAULT_CSV_PATH}`);
    console.error('4. Run this script again');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 1: Fetch all locations from Supabase to build name -> id mapping
  console.log('1. Fetching locations from Supabase...');
  const { data: locations, error: locError } = await supabase
    .from('google_locations')
    .select('id, name, short_name')
    .not('google_account_id', 'is', null);

  if (locError) {
    console.error('Failed to fetch locations:', locError);
    process.exit(1);
  }

  if (!locations || locations.length === 0) {
    console.error('No locations found in google_locations table');
    process.exit(1);
  }

  console.log(`   Found ${locations.length} locations:`);

  // Build lookup map (try both name and short_name)
  const locationMap: LocationMap = {};
  for (const loc of locations) {
    console.log(`   - ${loc.short_name || loc.name} (${loc.id})`);
    // Index by both name and short_name for flexible matching
    if (loc.name) {
      locationMap[loc.name.toLowerCase()] = loc.id;
    }
    if (loc.short_name) {
      locationMap[loc.short_name.toLowerCase()] = loc.id;
    }
  }

  // Add explicit mappings for business names in CSV that don't match DB names
  // The CSV uses business names + city, but DB uses short location names
  // Map: "business name|city" -> location short_name (which is already in locationMap)
  const businessNameMappings: Record<string, string> = {
    // Christmas Air locations - use city name
    "christmas air conditioning and plumbing|argyle": "argyle",
    "christmas air conditioning and plumbing|denton": "denton",
    "christmas air conditioning and plumbing|fort worth": "fort worth",
    "christmas air conditioning and plumbing|flower mound": "flower mound",
    "christmas air conditioning and plumbing|prosper": "prosper",
    "christmas air conditioning and plumbing|justin": "justin",
    "christmas air conditioning and plumbing|lewisville": "xmas lewisville",
    // Bart's locations
    "bart's heating and air|lewisville": "bart's lewisville",
    "bart's heating & air|lewisville": "bart's lewisville",
    // Mims - treat as separate or map to a location if applicable
    // (Skip Mims if it's not in the DB)
  };

  // Function to resolve location ID from business name and city
  const resolveLocationId = (businessName: string, city: string): string | null => {
    const key = `${businessName.toLowerCase()}|${city.toLowerCase()}`;
    const mappedName = businessNameMappings[key];
    if (mappedName) {
      return locationMap[mappedName] || null;
    }
    // Fallback: try direct city name match
    if (city) {
      return locationMap[city.toLowerCase()] || null;
    }
    // Fallback: try business name directly
    return locationMap[businessName.toLowerCase()] || null;
  };

  // Step 2: Read data from CSV file
  console.log(`\n2. Reading data from CSV: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    console.error('CSV appears to be empty or has no data rows');
    process.exit(1);
  }

  // Parse CSV into 2D array
  const sheetData: string[][] = lines.map(line => parseCSVLine(line));

  // Parse header row to verify column structure
  const headers = sheetData[0].map(h => h?.toLowerCase().trim() || '');
  console.log(`   Found ${sheetData.length - 1} data rows`);
  console.log(`   Headers: ${headers.join(', ')}`);

  // Expected columns (adjust indices based on actual sheet structure):
  // Date | Location | City | Maps Desktop | Maps Mobile | Search Desktop | Search Mobile | Website Clicks | Call Clicks | Direction Requests
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const locationIdx = headers.findIndex(h => h.includes('location'));
  const cityIdx = headers.findIndex(h => h.includes('city'));
  const mapsDesktopIdx = headers.findIndex(h => h.includes('maps') && h.includes('desktop'));
  const mapsMobileIdx = headers.findIndex(h => h.includes('maps') && h.includes('mobile'));
  const searchDesktopIdx = headers.findIndex(h => h.includes('search') && h.includes('desktop'));
  const searchMobileIdx = headers.findIndex(h => h.includes('search') && h.includes('mobile'));
  const websiteIdx = headers.findIndex(h => h.includes('website'));
  const callIdx = headers.findIndex(h => h.includes('call'));
  const directionsIdx = headers.findIndex(h => h.includes('direction'));

  console.log(`\n   Column mapping:`);
  console.log(`   - Date: col ${dateIdx}`);
  console.log(`   - Location: col ${locationIdx}`);
  console.log(`   - City: col ${cityIdx}`);
  console.log(`   - Maps Desktop: col ${mapsDesktopIdx}`);
  console.log(`   - Maps Mobile: col ${mapsMobileIdx}`);
  console.log(`   - Search Desktop: col ${searchDesktopIdx}`);
  console.log(`   - Search Mobile: col ${searchMobileIdx}`);
  console.log(`   - Website Clicks: col ${websiteIdx}`);
  console.log(`   - Call Clicks: col ${callIdx}`);
  console.log(`   - Directions: col ${directionsIdx}`);

  // Step 3: Parse and transform rows
  console.log('\n3. Parsing sheet data...');

  const rows: SheetRow[] = [];
  const unmatchedLocations = new Set<string>();

  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length === 0) continue;

    const dateStr = row[dateIdx]?.trim();
    const locationName = row[locationIdx]?.trim();
    const cityName = cityIdx >= 0 ? (row[cityIdx]?.trim() || '') : '';

    if (!dateStr || !locationName) continue;

    // Parse date - handle various formats
    let date: string;
    try {
      // Try parsing as MM/DD/YYYY or YYYY-MM-DD
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        console.warn(`   Row ${i + 1}: Invalid date "${dateStr}", skipping`);
        continue;
      }
      date = parsed.toISOString().split('T')[0];
    } catch {
      console.warn(`   Row ${i + 1}: Failed to parse date "${dateStr}", skipping`);
      continue;
    }

    // Look up location ID using business name + city
    const locationId = resolveLocationId(locationName, cityName);
    if (!locationId) {
      unmatchedLocations.add(`${locationName}${cityName ? ` (${cityName})` : ''}`);
      continue;
    }

    rows.push({
      date,
      location: locationId,
      mapsDesktop: parseInt(row[mapsDesktopIdx] || '0', 10) || 0,
      mapsMobile: parseInt(row[mapsMobileIdx] || '0', 10) || 0,
      searchDesktop: parseInt(row[searchDesktopIdx] || '0', 10) || 0,
      searchMobile: parseInt(row[searchMobileIdx] || '0', 10) || 0,
      websiteClicks: parseInt(row[websiteIdx] || '0', 10) || 0,
      callClicks: parseInt(row[callIdx] || '0', 10) || 0,
      directionRequests: parseInt(row[directionsIdx] || '0', 10) || 0,
    });
  }

  if (unmatchedLocations.size > 0) {
    console.warn(`\n   WARNING: ${unmatchedLocations.size} unmatched location names:`);
    Array.from(unmatchedLocations).forEach(name => {
      console.warn(`   - "${name}"`);
    });
  }

  console.log(`   Parsed ${rows.length} valid rows`);

  // Step 4: Transform to database format
  console.log('\n4. Preparing database records...');

  const dbRecords = rows.map(row => ({
    location_id: row.location,
    date: row.date,
    views_maps: row.mapsDesktop + row.mapsMobile,
    views_search: row.searchDesktop + row.searchMobile,
    website_clicks: row.websiteClicks,
    phone_calls: row.callClicks,
    direction_requests: row.directionRequests,
    bookings: 0, // Not in sheet data
    fetched_at: new Date().toISOString(),
  }));

  // Step 5: Upsert into Supabase in batches
  console.log('\n5. Upserting to Supabase...');

  const BATCH_SIZE = 500;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
    const batch = dbRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('gbp_insights_cache')
      .upsert(batch, {
        onConflict: 'location_id,date',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`   Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
      totalErrors += batch.length;
    } else {
      totalUpserted += batch.length;
      process.stdout.write(`   Progress: ${totalUpserted}/${dbRecords.length} rows\r`);
    }
  }

  console.log(`\n\n=== Import Complete ===`);
  console.log(`   Total rows processed: ${dbRecords.length}`);
  console.log(`   Successfully upserted: ${totalUpserted}`);
  console.log(`   Errors: ${totalErrors}`);

  // Verification query
  const { count } = await supabase
    .from('gbp_insights_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`\n   Total rows in gbp_insights_cache: ${count}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
