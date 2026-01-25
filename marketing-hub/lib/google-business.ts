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
}

// Singleton instance
let _client: GoogleBusinessClient | null = null;

export function getGoogleBusinessClient(): GoogleBusinessClient {
  if (!_client) {
    _client = new GoogleBusinessClient();
  }
  return _client;
}
