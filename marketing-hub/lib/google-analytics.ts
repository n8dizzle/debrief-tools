/**
 * Google Analytics 4 Data API client
 *
 * Setup required:
 * 1. Enable Google Analytics Data API in Google Cloud Console
 * 2. Create OAuth 2.0 credentials (can share with GBP)
 * 3. Set up environment variables:
 *    - GA4_PROPERTY_ID (just the number, e.g., "463761214")
 *    - GA4_CLIENT_ID (can reuse GOOGLE_BUSINESS_CLIENT_ID if same project)
 *    - GA4_CLIENT_SECRET
 *    - GA4_REFRESH_TOKEN
 */

import { google } from 'googleapis';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '463761214';

// Types for GA4 API responses
export interface GA4DateRange {
  startDate: string;
  endDate: string;
}

export interface GA4MetricValue {
  value: string;
}

export interface GA4DimensionValue {
  value: string;
}

export interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

export interface GA4Response {
  rows?: GA4Row[];
  rowCount?: number;
  metadata?: {
    currencyCode?: string;
    timeZone?: string;
  };
}

// Aggregated data types for the dashboard
export interface TrafficOverview {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  current: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number; // in seconds
    engagementRate: number;
  };
  previous: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  engagementRate: number;
}

export interface TopPage {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

export interface ConversionEvent {
  eventName: string;
  eventCount: number;
  totalUsers: number;
}

export interface DailyTraffic {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  engagementRate: number;
  avgSessionDuration: number;
}

export class GoogleAnalyticsClient {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // Can share OAuth credentials with GBP if they have Analytics scope
    const clientId = process.env.GA4_CLIENT_ID || process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GA4_CLIENT_SECRET || process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const refreshToken = process.env.GA4_REFRESH_TOKEN || process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('Google Analytics credentials not configured');
      return;
    }

    try {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Analytics client:', error);
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.oauth2Client !== null;
  }

  /**
   * Run a GA4 report with US-only filter
   */
  private async runReport(request: {
    dateRanges: GA4DateRange[];
    metrics: { name: string }[];
    dimensions?: { name: string }[];
    orderBys?: { metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }[];
    limit?: number;
    filterByUS?: boolean;
  }): Promise<GA4Response> {
    if (!this.oauth2Client) {
      throw new Error('Google Analytics client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const body: Record<string, unknown> = {
      dateRanges: request.dateRanges,
      metrics: request.metrics,
      dimensions: request.dimensions || [],
      limit: request.limit || 10000,
    };

    // Add US-only filter
    if (request.filterByUS !== false) {
      body.dimensionFilter = {
        filter: {
          fieldName: 'country',
          stringFilter: {
            matchType: 'EXACT',
            value: 'United States',
          },
        },
      };
    }

    if (request.orderBys && request.orderBys.length > 0) {
      body.orderBys = request.orderBys;
    }

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GA4] API Error:', error);
      throw new Error(`GA4 API Error: ${error}`);
    }

    return response.json();
  }

  /**
   * Get traffic overview metrics
   */
  async getTrafficOverview(days: number = 30, startDateStr?: string, endDateStr?: string): Promise<TrafficOverview> {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr + 'T00:00:00');
      endDate = new Date(endDateStr + 'T00:00:00');
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff + 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const currentPeriod = { start: formatDate(startDate), end: formatDate(endDate) };
    const previousPeriod = { start: formatDate(prevStartDate), end: formatDate(prevEndDate) };

    const response = await this.runReport({
      dateRanges: [
        { startDate: currentPeriod.start, endDate: currentPeriod.end },
        { startDate: previousPeriod.start, endDate: previousPeriod.end },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'engagementRate' },
      ],
    });

    const parseMetrics = (row: GA4Row | undefined) => {
      if (!row) {
        return {
          sessions: 0,
          users: 0,
          newUsers: 0,
          pageviews: 0,
          bounceRate: 0,
          avgSessionDuration: 0,
          engagementRate: 0,
        };
      }
      return {
        sessions: parseInt(row.metricValues[0]?.value || '0', 10),
        users: parseInt(row.metricValues[1]?.value || '0', 10),
        newUsers: parseInt(row.metricValues[2]?.value || '0', 10),
        pageviews: parseInt(row.metricValues[3]?.value || '0', 10),
        bounceRate: parseFloat(row.metricValues[4]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues[5]?.value || '0'),
        engagementRate: parseFloat(row.metricValues[6]?.value || '0'),
      };
    };

    // GA4 returns rows for each date range
    const currentRow = response.rows?.[0];
    const previousRow = response.rows?.[1];

    return {
      period: currentPeriod,
      previousPeriod,
      current: parseMetrics(currentRow),
      previous: parseMetrics(previousRow),
    };
  }

  /**
   * Get daily traffic data for charts
   */
  async getDailyTraffic(days: number = 30, startDateStr?: string, endDateStr?: string): Promise<DailyTraffic[]> {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr + 'T00:00:00');
      endDate = new Date(endDateStr + 'T00:00:00');
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await this.runReport({
      dateRanges: [
        { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      ],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    return (response.rows || []).map((row) => ({
      date: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0]?.value || '0', 10),
      users: parseInt(row.metricValues[1]?.value || '0', 10),
      newUsers: parseInt(row.metricValues[2]?.value || '0', 10),
      pageviews: parseInt(row.metricValues[3]?.value || '0', 10),
      engagementRate: parseFloat(row.metricValues[4]?.value || '0'),
      avgSessionDuration: parseFloat(row.metricValues[5]?.value || '0'),
    }));
  }

  /**
   * Get traffic sources breakdown
   */
  async getTrafficSources(days: number = 30, limit: number = 10, startDateStr?: string, endDateStr?: string): Promise<TrafficSource[]> {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr + 'T00:00:00');
      endDate = new Date(endDateStr + 'T00:00:00');
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await this.runReport({
      dateRanges: [
        { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      ],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'engagementRate' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    });

    return (response.rows || []).map((row) => ({
      source: row.dimensionValues[0].value || '(direct)',
      medium: row.dimensionValues[1].value || '(none)',
      sessions: parseInt(row.metricValues[0]?.value || '0', 10),
      users: parseInt(row.metricValues[1]?.value || '0', 10),
      newUsers: parseInt(row.metricValues[2]?.value || '0', 10),
      bounceRate: parseFloat(row.metricValues[3]?.value || '0'),
      engagementRate: parseFloat(row.metricValues[4]?.value || '0'),
    }));
  }

  /**
   * Get top pages
   */
  async getTopPages(days: number = 30, limit: number = 20, startDateStr?: string, endDateStr?: string): Promise<TopPage[]> {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr + 'T00:00:00');
      endDate = new Date(endDateStr + 'T00:00:00');
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await this.runReport({
      dateRanges: [
        { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      ],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit,
    });

    return (response.rows || []).map((row) => {
      const pageviews = parseInt(row.metricValues[0]?.value || '0', 10);
      const engagementDuration = parseFloat(row.metricValues[2]?.value || '0');

      return {
        pagePath: row.dimensionValues[0].value,
        pageTitle: row.dimensionValues[1].value || row.dimensionValues[0].value,
        pageviews,
        uniquePageviews: parseInt(row.metricValues[1]?.value || '0', 10),
        avgTimeOnPage: pageviews > 0 ? engagementDuration / pageviews : 0,
        bounceRate: parseFloat(row.metricValues[3]?.value || '0'),
      };
    });
  }

  /**
   * Get conversion events
   */
  async getConversions(days: number = 30, startDateStr?: string, endDateStr?: string): Promise<ConversionEvent[]> {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr + 'T00:00:00');
      endDate = new Date(endDateStr + 'T00:00:00');
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await this.runReport({
      dateRanges: [
        { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      ],
      dimensions: [
        { name: 'eventName' },
        { name: 'isConversionEvent' },
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' },
      ],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    });

    // Filter to only conversion events
    return (response.rows || [])
      .filter((row) => row.dimensionValues[1].value === 'true')
      .map((row) => ({
        eventName: row.dimensionValues[0].value,
        eventCount: parseInt(row.metricValues[0]?.value || '0', 10),
        totalUsers: parseInt(row.metricValues[1]?.value || '0', 10),
      }));
  }

  /**
   * Get all events (conversions and non-conversions)
   */
  async getAllEvents(days: number = 30, limit: number = 50): Promise<Array<{
    eventName: string;
    isConversion: boolean;
    eventCount: number;
    totalUsers: number;
  }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await this.runReport({
      dateRanges: [
        { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      ],
      dimensions: [
        { name: 'eventName' },
        { name: 'isConversionEvent' },
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' },
      ],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit,
    });

    return (response.rows || []).map((row) => ({
      eventName: row.dimensionValues[0].value,
      isConversion: row.dimensionValues[1].value === 'true',
      eventCount: parseInt(row.metricValues[0]?.value || '0', 10),
      totalUsers: parseInt(row.metricValues[1]?.value || '0', 10),
    }));
  }
}

// Singleton instance
let _client: GoogleAnalyticsClient | null = null;

export function getGoogleAnalyticsClient(): GoogleAnalyticsClient {
  if (!_client) {
    _client = new GoogleAnalyticsClient();
  }
  return _client;
}
