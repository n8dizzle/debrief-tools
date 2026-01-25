/**
 * Google Business Profile API client for fetching reviews and managing posts.
 * Uses OAuth 2.0 for authentication.
 *
 * Setup required:
 * 1. Enable Google Business Profile API in Google Cloud Console
 * 2. Create OAuth 2.0 credentials
 * 3. Set up environment variables:
 *    - GOOGLE_BUSINESS_CLIENT_ID
 *    - GOOGLE_BUSINESS_CLIENT_SECRET
 *    - GOOGLE_BUSINESS_REFRESH_TOKEN
 */

import { google } from 'googleapis';

export interface ReviewMedia {
  mediaFormat: 'PHOTO' | 'VIDEO';
  googleUrl: string;
}

export interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime?: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
  media?: ReviewMedia[];
}

export interface LocationInfo {
  name: string;
  locationName: string;
  primaryCategory?: string;
  address?: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
  };
  metadata?: {
    placeId?: string;
  };
}

export interface ReviewsResponse {
  reviews: GoogleReview[];
  totalReviewCount: number;
  averageRating: number;
  nextPageToken?: string;
}

// ============================================
// LOCAL POST TYPES (for GBP Posts)
// ============================================

export type LocalPostTopicType = 'STANDARD' | 'EVENT' | 'OFFER';
export type LocalPostState = 'LOCAL_POST_STATE_UNSPECIFIED' | 'REJECTED' | 'LIVE' | 'PROCESSING';

export interface LocalPostMedia {
  mediaFormat: 'PHOTO' | 'VIDEO';
  sourceUrl: string;
}

export interface LocalPostEvent {
  title: string;
  schedule: {
    startDate: { year: number; month: number; day: number };
    startTime?: { hours: number; minutes: number };
    endDate: { year: number; month: number; day: number };
    endTime?: { hours: number; minutes: number };
  };
}

export interface LocalPostOffer {
  couponCode?: string;
  redeemOnlineUrl?: string;
  termsConditions?: string;
}

export interface LocalPostCallToAction {
  actionType: 'ACTION_TYPE_UNSPECIFIED' | 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'GET_OFFER' | 'CALL';
  url?: string;
}

export interface LocalPost {
  name?: string;
  languageCode?: string;
  summary: string;
  callToAction?: LocalPostCallToAction;
  media?: LocalPostMedia[];
  topicType: LocalPostTopicType;
  event?: LocalPostEvent;
  offer?: LocalPostOffer;
  state?: LocalPostState;
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
}

export interface LocalPostsResponse {
  localPosts: LocalPost[];
  nextPageToken?: string;
}

export interface CreateLocalPostRequest {
  summary: string;
  topicType: LocalPostTopicType;
  callToAction?: LocalPostCallToAction;
  media?: LocalPostMedia[];
  event?: LocalPostEvent;
  offer?: LocalPostOffer;
}

const STAR_RATING_MAP: Record<string, number> = {
  'ONE': 1,
  'TWO': 2,
  'THREE': 3,
  'FOUR': 4,
  'FIVE': 5,
};

// ============================================
// GBP INSIGHTS/PERFORMANCE TYPES
// ============================================

export type InsightMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_CONVERSATIONS'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'CALL_CLICKS'
  | 'WEBSITE_CLICKS'
  | 'BUSINESS_BOOKINGS'
  | 'BUSINESS_FOOD_ORDERS'
  | 'BUSINESS_FOOD_MENU_CLICKS';

export interface DailyMetricValue {
  date: { year: number; month: number; day: number };
  value?: string;
}

export interface TimeSeries {
  datedValues: DailyMetricValue[];
}

export interface DailyMetricTimeSeries {
  dailyMetric: InsightMetric;
  timeSeries: TimeSeries;
}

export interface InsightsResponse {
  multiDailyMetricTimeSeries?: DailyMetricTimeSeries[];
  nextPageToken?: string;
}

// Aggregated insights for dashboard display
export interface LocationInsights {
  locationId: string;
  locationName: string;
  period: { start: string; end: string };
  viewsMaps: number;
  viewsSearch: number;
  totalViews: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
  bookings: number;
}

export interface AggregatedInsights {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  current: {
    totalViews: number;
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  };
  previous: {
    totalViews: number;
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  };
  byLocation: LocationInsights[];
}

export function starRatingToNumber(rating: string): number {
  return STAR_RATING_MAP[rating] || 0;
}

export class GoogleBusinessClient {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the OAuth2 client with credentials
   */
  private initialize(): void {
    if (this.initialized) return;

    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('Google Business Profile API credentials not configured');
      return;
    }

    try {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground' // Redirect URI used for getting refresh token
      );

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Business client:', error);
    }
  }

  /**
   * Check if the client is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized && this.oauth2Client !== null;
  }

  /**
   * Get all accounts accessible by the authenticated user
   */
  async listAccounts(): Promise<{ accounts: Array<{ name: string; accountName: string }> }> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const response = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list accounts: ${error}`);
    }

    return response.json();
  }

  /**
   * Get all locations for an account
   */
  async listLocations(accountId: string): Promise<{ locations: LocationInfo[] }> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress,metadata`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list locations: ${error}`);
    }

    return response.json();
  }

  /**
   * Get reviews for a specific location
   */
  async getReviews(
    accountId: string,
    locationId: string,
    pageSize: number = 50,
    pageToken?: string
  ): Promise<ReviewsResponse> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    let url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?pageSize=${pageSize}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get reviews: ${error}`);
    }

    return response.json();
  }

  /**
   * Get all reviews for a location (handles pagination)
   */
  async getAllReviews(
    accountId: string,
    locationId: string
  ): Promise<GoogleReview[]> {
    const allReviews: GoogleReview[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getReviews(accountId, locationId, 50, pageToken);

      if (response.reviews) {
        allReviews.push(...response.reviews);
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return allReviews;
  }

  /**
   * Reply to a Google review
   * @param accountId - The account ID (e.g., "accounts/123456")
   * @param locationId - The location ID (e.g., "locations/789")
   * @param reviewId - The review ID
   * @param comment - The reply text (max 4096 characters)
   * @returns The updated review reply
   */
  async replyToReview(
    accountId: string,
    locationId: string,
    reviewId: string,
    comment: string
  ): Promise<{ comment: string; updateTime: string }> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    if (comment.length > 4096) {
      throw new Error('Reply comment exceeds maximum length of 4096 characters');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    // The review name format is: accounts/{account_id}/locations/{location_id}/reviews/{review_id}
    const reviewName = `${accountId}/${locationId}/reviews/${reviewId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to reply to review: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete a reply from a Google review
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param reviewId - The review ID
   */
  async deleteReply(
    accountId: string,
    locationId: string,
    reviewId: string
  ): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const reviewName = `${accountId}/${locationId}/reviews/${reviewId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete reply: ${error}`);
    }
  }

  /**
   * Get a single review by ID
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param reviewId - The review ID
   */
  async getReview(
    accountId: string,
    locationId: string,
    reviewId: string
  ): Promise<GoogleReview> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const reviewName = `${accountId}/${locationId}/reviews/${reviewId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get review: ${error}`);
    }

    return response.json();
  }

  // ============================================
  // LOCAL POSTS METHODS (for GBP Posts)
  // ============================================

  /**
   * Create a local post for a location
   * @param accountId - The account ID (e.g., "accounts/123456")
   * @param locationId - The location ID (e.g., "locations/789")
   * @param post - The post data
   */
  async createLocalPost(
    accountId: string,
    locationId: string,
    post: CreateLocalPostRequest
  ): Promise<LocalPost> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    const locationName = `${accountId}/${locationId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          languageCode: 'en-US',
          summary: post.summary,
          topicType: post.topicType,
          ...(post.callToAction && { callToAction: post.callToAction }),
          ...(post.media && post.media.length > 0 && { media: post.media }),
          ...(post.event && { event: post.event }),
          ...(post.offer && { offer: post.offer }),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create local post: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete a local post
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param postId - The post ID (just the ID, not the full name)
   */
  async deleteLocalPost(
    accountId: string,
    locationId: string,
    postId: string
  ): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    const postName = `${accountId}/${locationId}/localPosts/${postId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${postName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete local post: ${error}`);
    }
  }

  /**
   * List local posts for a location
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param pageSize - Number of posts per page (max 100)
   * @param pageToken - Token for pagination
   */
  async listLocalPosts(
    accountId: string,
    locationId: string,
    pageSize: number = 50,
    pageToken?: string
  ): Promise<LocalPostsResponse> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    const locationName = `${accountId}/${locationId}`;

    let url = `https://mybusiness.googleapis.com/v4/${locationName}/localPosts?pageSize=${pageSize}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list local posts: ${error}`);
    }

    return response.json();
  }

  /**
   * Get a single local post by ID
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param postId - The post ID
   */
  async getLocalPost(
    accountId: string,
    locationId: string,
    postId: string
  ): Promise<LocalPost> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    const postName = `${accountId}/${locationId}/localPosts/${postId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${postName}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get local post: ${error}`);
    }

    return response.json();
  }

  /**
   * Upload a photo to Google Business Profile media library
   * The photo must be accessible via a public URL
   * @param accountId - The account ID
   * @param locationId - The location ID
   * @param sourceUrl - Public URL of the photo to upload
   * @param category - Photo category (defaults to ADDITIONAL)
   */
  async uploadMediaFromUrl(
    accountId: string,
    locationId: string,
    sourceUrl: string,
    category: 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL' = 'ADDITIONAL'
  ): Promise<{ name: string; mediaFormat: string; sourceUrl: string }> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();
    const locationName = `${accountId}/${locationId}`;

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaFormat: 'PHOTO',
          sourceUrl,
          locationAssociation: {
            category,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload media: ${error}`);
    }

    return response.json();
  }

  // ============================================
  // INSIGHTS/PERFORMANCE METHODS
  // ============================================

  /**
   * Get performance insights for a specific location
   * Uses the Business Profile Performance API
   * @param locationName - Full location name (e.g., "locations/12345678901234567")
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Daily metric time series for the location
   */
  async getLocationInsights(
    locationName: string,
    startDate: string,
    endDate: string
  ): Promise<InsightsResponse> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Build the request body for fetchMultiDailyMetricsTimeSeries
    const requestBody = {
      dailyRange: {
        startDate: {
          year: start.getFullYear(),
          month: start.getMonth() + 1,
          day: start.getDate(),
        },
        endDate: {
          year: end.getFullYear(),
          month: end.getMonth() + 1,
          day: end.getDate(),
        },
      },
      dailyMetrics: [
        'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
        'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
        'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
        'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
        'CALL_CLICKS',
        'WEBSITE_CLICKS',
        'BUSINESS_DIRECTION_REQUESTS',
        'BUSINESS_BOOKINGS',
      ],
    };

    // Use the Business Profile Performance API
    const response = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch location insights: ${error}`);
    }

    return response.json();
  }

  /**
   * Aggregate insights from a single location's response
   * @param insights - Raw insights response from API
   * @param locationId - Database location ID
   * @param locationName - Display name of location
   * @param period - Date range for the insights
   */
  aggregateLocationInsights(
    insights: InsightsResponse,
    locationId: string,
    locationName: string,
    period: { start: string; end: string }
  ): LocationInsights {
    let viewsMaps = 0;
    let viewsSearch = 0;
    let websiteClicks = 0;
    let phoneCalls = 0;
    let directionRequests = 0;
    let bookings = 0;

    if (insights.multiDailyMetricTimeSeries) {
      for (const series of insights.multiDailyMetricTimeSeries) {
        const total = series.timeSeries?.datedValues?.reduce((sum, dv) => {
          return sum + parseInt(dv.value || '0', 10);
        }, 0) || 0;

        switch (series.dailyMetric) {
          case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
          case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
            viewsMaps += total;
            break;
          case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
          case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
            viewsSearch += total;
            break;
          case 'WEBSITE_CLICKS':
            websiteClicks += total;
            break;
          case 'CALL_CLICKS':
            phoneCalls += total;
            break;
          case 'BUSINESS_DIRECTION_REQUESTS':
            directionRequests += total;
            break;
          case 'BUSINESS_BOOKINGS':
            bookings += total;
            break;
        }
      }
    }

    return {
      locationId,
      locationName,
      period,
      viewsMaps,
      viewsSearch,
      totalViews: viewsMaps + viewsSearch,
      websiteClicks,
      phoneCalls,
      directionRequests,
      bookings,
    };
  }

  /**
   * Get insights for multiple locations and aggregate them
   * @param locations - Array of location objects with googleLocationId and name
   * @param days - Number of days to fetch (default 30)
   * @returns Aggregated insights across all locations
   */
  async getMultiLocationInsights(
    locations: Array<{
      id: string;
      name: string;
      google_location_id: string;
    }>,
    days: number = 30
  ): Promise<AggregatedInsights> {
    const endDate = new Date();
    // Account for 2-3 day data delay from Google
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days + 1);

    // Previous period for comparison
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - days + 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const currentPeriod = { start: formatDate(startDate), end: formatDate(endDate) };
    const previousPeriod = { start: formatDate(prevStartDate), end: formatDate(prevEndDate) };

    // Fetch current period for all locations in parallel
    const currentPromises = locations.map(async (loc) => {
      try {
        const insights = await this.getLocationInsights(
          loc.google_location_id,
          currentPeriod.start,
          currentPeriod.end
        );
        return this.aggregateLocationInsights(insights, loc.id, loc.name, currentPeriod);
      } catch (error) {
        console.error(`Failed to fetch insights for ${loc.name}:`, error);
        // Return zeros for failed locations
        return {
          locationId: loc.id,
          locationName: loc.name,
          period: currentPeriod,
          viewsMaps: 0,
          viewsSearch: 0,
          totalViews: 0,
          websiteClicks: 0,
          phoneCalls: 0,
          directionRequests: 0,
          bookings: 0,
        };
      }
    });

    // Fetch previous period for comparison (aggregate only, not per-location)
    const previousPromises = locations.map(async (loc) => {
      try {
        const insights = await this.getLocationInsights(
          loc.google_location_id,
          previousPeriod.start,
          previousPeriod.end
        );
        return this.aggregateLocationInsights(insights, loc.id, loc.name, previousPeriod);
      } catch {
        return null;
      }
    });

    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises),
    ]);

    // Aggregate totals
    const current = currentResults.reduce(
      (acc, loc) => ({
        totalViews: acc.totalViews + loc.totalViews,
        viewsMaps: acc.viewsMaps + loc.viewsMaps,
        viewsSearch: acc.viewsSearch + loc.viewsSearch,
        websiteClicks: acc.websiteClicks + loc.websiteClicks,
        phoneCalls: acc.phoneCalls + loc.phoneCalls,
        directionRequests: acc.directionRequests + loc.directionRequests,
      }),
      { totalViews: 0, viewsMaps: 0, viewsSearch: 0, websiteClicks: 0, phoneCalls: 0, directionRequests: 0 }
    );

    const previous = previousResults.reduce(
      (acc, loc) => {
        if (!loc) return acc;
        return {
          totalViews: acc.totalViews + loc.totalViews,
          viewsMaps: acc.viewsMaps + loc.viewsMaps,
          viewsSearch: acc.viewsSearch + loc.viewsSearch,
          websiteClicks: acc.websiteClicks + loc.websiteClicks,
          phoneCalls: acc.phoneCalls + loc.phoneCalls,
          directionRequests: acc.directionRequests + loc.directionRequests,
        };
      },
      { totalViews: 0, viewsMaps: 0, viewsSearch: 0, websiteClicks: 0, phoneCalls: 0, directionRequests: 0 }
    );

    return {
      period: currentPeriod,
      previousPeriod,
      current,
      previous,
      byLocation: currentResults,
    };
  }
}

// Singleton instance
let _client: GoogleBusinessClient | null = null;

export function getGoogleBusinessClient(): GoogleBusinessClient {
  if (!_client) {
    _client = new GoogleBusinessClient();
  }
  return _client;
}
