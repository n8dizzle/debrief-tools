import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';

function getSheetsAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Parse "02/10/2026" → "2026-02-10"
function parseDate(val: string): string | null {
  if (!val) return null;
  const parts = val.split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    // Fetch campaign mapping from Supabase and sheet data in parallel
    const supabase = getServerSupabase();
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const [mappingResult, sheetResult] = await Promise.all([
      supabase
        .from('st_campaign_reports')
        .select('campaign_name, channel, category')
        .not('campaign_name', 'is', null),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Booked Jobs'",
      }),
    ]);

    // Build campaign → { channel, category } lookup
    const campaignMap = new Map<string, { channel: string; category: string }>();
    for (const row of mappingResult.data || []) {
      if (row.campaign_name && !campaignMap.has(row.campaign_name)) {
        campaignMap.set(row.campaign_name, {
          channel: row.channel,
          category: row.category,
        });
      }
    }

    // Fallback mappings for campaigns not in st_campaign_reports
    const fallbackMap: Record<string, { channel: string; category: string }> = {
      '01 - Existing Customer': { channel: 'Existing Customer', category: 'Existing Customer' },
      '03 - Outbound': { channel: 'Outbound', category: 'Outbound' },
      '04 - Loyal Customer - Active for 3 years+': { channel: 'Existing Customer', category: 'Existing Customer' },
      'Facebook/Meta': { channel: 'Meta/Facebook', category: 'Meta/Facebook' },
      'Nextdoor': { channel: 'Nextdoor', category: 'Nextdoor' },
    };

    const rows = sheetResult.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ daily: [], campaigns: [], categories: [] });
    }

    // Headers: Created Date(0), Job #(1), Job Type(2), Job Campaign(3), Business Unit(4), ...
    const dataRows = rows.slice(1);

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    // Group by date + campaign + category
    const dailyMap = new Map<string, Map<string, number>>(); // date → category → count
    const dailyCampaignMap = new Map<string, Map<string, number>>(); // date → campaign → count
    const allCategories = new Set<string>();
    const allCampaigns = new Set<string>();

    for (const row of dataRows) {
      const dateStr = parseDate(row[0]);
      if (!dateStr || dateStr < cutoffStr) continue;

      const campaign = row[3] || 'Unknown';
      const lookup = campaignMap.get(campaign) || fallbackMap[campaign] || { channel: campaign, category: 'Unknown' };
      const category = lookup.channel;

      allCategories.add(category);
      allCampaigns.add(campaign);

      // By category
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, new Map());
      const dayCategories = dailyMap.get(dateStr)!;
      dayCategories.set(category, (dayCategories.get(category) || 0) + 1);

      // By campaign
      if (!dailyCampaignMap.has(dateStr)) dailyCampaignMap.set(dateStr, new Map());
      const dayCampaigns = dailyCampaignMap.get(dateStr)!;
      dayCampaigns.set(campaign, (dayCampaigns.get(campaign) || 0) + 1);
    }

    // Build sorted daily arrays
    const sortedDates = [...dailyMap.keys()].sort();
    const categoryList = [...allCategories].sort();
    const campaignList = [...allCampaigns].sort();

    const dailyByCategory = sortedDates.map(date => {
      const cats = dailyMap.get(date)!;
      const entry: Record<string, string | number> = { date };
      let total = 0;
      for (const cat of categoryList) {
        entry[cat] = cats.get(cat) || 0;
        total += cats.get(cat) || 0;
      }
      entry.total = total;
      return entry;
    });

    const dailyByCampaign = sortedDates.map(date => {
      const camps = dailyCampaignMap.get(date)!;
      const entry: Record<string, string | number> = { date };
      let total = 0;
      for (const camp of campaignList) {
        entry[camp] = camps.get(camp) || 0;
        total += camps.get(camp) || 0;
      }
      entry.total = total;
      return entry;
    });

    // Campaign → category mapping for the frontend
    const campaignCategories: Record<string, { channel: string; category: string }> = {};
    for (const camp of campaignList) {
      campaignCategories[camp] = campaignMap.get(camp) || fallbackMap[camp] || { channel: camp, category: 'Unknown' };
    }

    return NextResponse.json({
      dailyByCategory,
      dailyByCampaign,
      categories: categoryList,
      campaigns: campaignList,
      campaignCategories,
    });
  } catch (err) {
    console.error('Dashboard leads error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch leads data' },
      { status: 500 }
    );
  }
}
