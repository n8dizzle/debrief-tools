/**
 * Script to sync reviews from Google Business Profile
 * Run with: node scripts/sync-reviews.js
 */

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment files
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), override: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function syncReviews() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  console.log('Initializing OAuth client...');

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { token } = await oauth2Client.getAccessToken();
  console.log('Access token obtained!\n');

  // Get locations from database
  const { data: locations, error: locError } = await supabase
    .from('google_locations')
    .select('*')
    .eq('is_active', true)
    .not('google_location_id', 'is', null);

  if (locError) {
    console.error('Failed to fetch locations:', locError);
    process.exit(1);
  }

  console.log(`Found ${locations.length} locations to sync\n`);

  let totalSynced = 0;

  for (const location of locations) {
    console.log(`\nSyncing: ${location.name}...`);

    try {
      // Fetch ALL reviews for this location (with pagination)
      let allReviews = [];
      let pageToken = null;
      let pageNum = 1;

      do {
        let reviewsUrl = `https://mybusiness.googleapis.com/v4/${location.google_account_id}/${location.google_location_id}/reviews?pageSize=50`;
        if (pageToken) {
          reviewsUrl += `&pageToken=${pageToken}`;
        }

        const response = await fetch(reviewsUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          const error = await response.text();
          console.log(`  ⚠️  Failed: ${error}`);
          break;
        }

        const data = await response.json();
        const reviews = data.reviews || [];
        allReviews = allReviews.concat(reviews);
        pageToken = data.nextPageToken;

        if (pageToken) {
          console.log(`  Page ${pageNum}: ${reviews.length} reviews (fetching more...)`);
          pageNum++;
        }
      } while (pageToken);

      const reviews = allReviews;

      console.log(`  Found ${reviews.length} reviews`);

      // Upsert reviews
      for (const review of reviews) {
        const reviewData = {
          location_id: location.id,
          google_review_id: review.reviewId,
          reviewer_name: review.reviewer?.displayName || 'Anonymous',
          reviewer_photo_url: review.reviewer?.profilePhotoUrl || null,
          star_rating: { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }[review.starRating] || 5,
          comment: review.comment || null,
          review_reply: review.reviewReply?.comment || null,
          reply_time: review.reviewReply?.updateTime || null,
          create_time: review.createTime,
          update_time: review.updateTime || null,
          is_processed: true,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('google_reviews')
          .upsert(reviewData, { onConflict: 'google_review_id' });

        if (upsertError) {
          console.log(`  ⚠️  Failed to upsert review: ${upsertError.message}`);
        } else {
          totalSynced++;
        }
      }

      // Update location stats
      const { data: reviewStats } = await supabase
        .from('google_reviews')
        .select('star_rating')
        .eq('location_id', location.id);

      if (reviewStats && reviewStats.length > 0) {
        const totalReviews = reviewStats.length;
        const avgRating = reviewStats.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews;

        await supabase
          .from('google_locations')
          .update({
            total_reviews: totalReviews,
            average_rating: Math.round(avgRating * 100) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq('id', location.id);

        console.log(`  ✅ ${totalReviews} reviews, ${avgRating.toFixed(2)} avg rating`);
      }

    } catch (err) {
      console.log(`  ⚠️  Error: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Sync complete! ${totalSynced} reviews synced.`);

  // Show summary
  const { data: summary } = await supabase
    .from('google_locations')
    .select('name, total_reviews, average_rating')
    .order('display_order');

  console.log('\nLocation Summary:');
  for (const loc of summary || []) {
    console.log(`  ${loc.name}: ${loc.total_reviews} reviews (${loc.average_rating} avg)`);
  }
}

syncReviews().catch(console.error);
