/**
 * Script to discover Google Business Profile locations
 * Run with: node scripts/discover-locations.js
 */

const { google } = require('googleapis');
require('dotenv').config();

async function discoverLocations() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('Missing Google Business credentials in .env');
    console.log('Expected: GOOGLE_BUSINESS_CLIENT_ID, GOOGLE_BUSINESS_CLIENT_SECRET, GOOGLE_BUSINESS_REFRESH_TOKEN');
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

    console.log('Access token obtained!\n');

    // List accounts
    console.log('Fetching accounts...');
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

    console.log(`Found ${accounts.length} account(s):\n`);
    console.log('='.repeat(80));

    for (const account of accounts) {
      console.log(`\nAccount: ${account.accountName || account.name}`);
      console.log(`  Account ID: ${account.name}`);
      console.log(`  Type: ${account.type || 'N/A'}`);

      // List locations for this account
      console.log('  Fetching locations...\n');

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
          console.log(`  ┌─ ${loc.title || 'Unnamed Location'}`);
          console.log(`  │  Location ID: ${loc.name}`);
          if (loc.storefrontAddress) {
            const addr = loc.storefrontAddress;
            const addrStr = [
              addr.addressLines?.join(', '),
              addr.locality,
              addr.administrativeArea,
              addr.postalCode
            ].filter(Boolean).join(', ');
            console.log(`  │  Address: ${addrStr}`);
          }
          if (loc.metadata?.placeId) {
            console.log(`  │  Place ID: ${loc.metadata.placeId}`);
          }
          console.log(`  └${'─'.repeat(60)}`);
          console.log('');
        }
      } else {
        const error = await locationsRes.text();
        console.log(`  Failed to fetch locations: ${error}`);
      }
    }

    console.log('='.repeat(80));
    console.log('\n📋 NEXT STEPS:');
    console.log('Copy the Account ID and Location ID for each location above.');
    console.log('Match them to your database locations and update Supabase.\n');

  } catch (error) {
    console.error('Error:', error.message || error);
    process.exit(1);
  }
}

discoverLocations();
