/**
 * Script to discover Google Business Profile locations
 * Run with: npx ts-node --esm scripts/discover-locations.ts
 */

import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

async function discoverLocations() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('Missing Google Business credentials in .env');
    process.exit(1);
  }

  console.log('Initializing OAuth client...');

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    // Get access token
    console.log('Getting access token...');
    const { token } = await oauth2Client.getAccessToken();

    if (!token) {
      console.error('Failed to get access token');
      process.exit(1);
    }

    // List accounts
    console.log('\nFetching accounts...');
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!accountsRes.ok) {
      const error = await accountsRes.text();
      console.error('Failed to list accounts:', error);
      process.exit(1);
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];

    console.log(`\nFound ${accounts.length} account(s):\n`);

    for (const account of accounts) {
      console.log(`Account: ${account.accountName || account.name}`);
      console.log(`  ID: ${account.name}`);
      console.log(`  Type: ${account.type || 'N/A'}`);

      // List locations for this account
      console.log('  Fetching locations...');

      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        const locations = locationsData.locations || [];

        console.log(`  Found ${locations.length} location(s):\n`);

        for (const loc of locations) {
          console.log(`    Location: ${loc.title || 'Unnamed'}`);
          console.log(`      Location ID: ${loc.name}`);
          if (loc.storefrontAddress) {
            const addr = loc.storefrontAddress;
            console.log(`      Address: ${addr.addressLines?.join(', ') || ''}, ${addr.locality || ''}, ${addr.administrativeArea || ''} ${addr.postalCode || ''}`);
          }
          if (loc.metadata?.placeId) {
            console.log(`      Place ID: ${loc.metadata.placeId}`);
          }
          console.log('');
        }
      } else {
        const error = await locationsRes.text();
        console.log(`  Failed to fetch locations: ${error}`);
      }
    }

    console.log('\n--- NEXT STEPS ---');
    console.log('Copy the Account ID and Location ID for each location above.');
    console.log('Then update the google_locations table in Supabase with:');
    console.log('  - google_account_id (e.g., accounts/123456789)');
    console.log('  - google_location_id (e.g., locations/987654321)');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

discoverLocations();
