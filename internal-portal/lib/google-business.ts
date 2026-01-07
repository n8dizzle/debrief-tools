/**
 * Google Business Profile API client for fetching reviews.
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

const STAR_RATING_MAP: Record<string, number> = {
  'ONE': 1,
  'TWO': 2,
  'THREE': 3,
  'FOUR': 4,
  'FIVE': 5,
};

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
   * Batch get reviews from multiple locations
   */
  async batchGetReviews(
    accountId: string,
    locationIds: string[]
  ): Promise<Record<string, GoogleReview[]>> {
    if (!this.oauth2Client) {
      throw new Error('Google Business client not configured');
    }

    const accessToken = await this.oauth2Client.getAccessToken();

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountId}/locations:batchGetReviews`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationNames: locationIds.map(id => `${accountId}/${id}`),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to batch get reviews: ${error}`);
    }

    const data = await response.json();
    const result: Record<string, GoogleReview[]> = {};

    if (data.locationReviews) {
      for (const locationReview of data.locationReviews) {
        const locationId = locationReview.name.split('/').pop();
        result[locationId] = locationReview.reviews || [];
      }
    }

    return result;
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

/**
 * Find team member mentions in review text
 */
export function findTeamMemberMentions(
  reviewText: string,
  teamMembers: Array<{ name: string; aliases?: string[] }>
): string[] {
  if (!reviewText) return [];

  const text = reviewText.toLowerCase();
  const mentions: string[] = [];

  for (const member of teamMembers) {
    const namesToCheck = [member.name, ...(member.aliases || [])];

    for (const name of namesToCheck) {
      // Check for whole word match (case insensitive)
      const regex = new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        if (!mentions.includes(member.name)) {
          mentions.push(member.name);
        }
        break;
      }
    }
  }

  return mentions;
}
