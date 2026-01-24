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
import { GoogleGenerativeAI } from '@google/generative-ai';

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
}

// Singleton instance
let _client: GoogleBusinessClient | null = null;

export function getGoogleBusinessClient(): GoogleBusinessClient {
  if (!_client) {
    _client = new GoogleBusinessClient();
  }
  return _client;
}

export interface TeamMember {
  name: string;
  aliases?: string[];
}

/**
 * Find team member mentions in review text using regex (fallback)
 */
export function findTeamMemberMentions(
  reviewText: string,
  teamMembers: TeamMember[]
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

/**
 * AI-powered team member mention detection using Google Gemini
 * More accurate than regex - handles nicknames, context, and variations
 */
export async function findTeamMemberMentionsAI(
  reviewText: string,
  teamMembers: TeamMember[]
): Promise<string[]> {
  if (!reviewText || teamMembers.length === 0) return [];

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not configured, falling back to regex');
    return findTeamMemberMentions(reviewText, teamMembers);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build employee list with aliases
    const employeeList = teamMembers.map(m => {
      if (m.aliases && m.aliases.length > 0) {
        return `${m.name} (also known as: ${m.aliases.join(', ')})`;
      }
      return m.name;
    }).join('\n');

    const prompt = `You are analyzing a customer review to identify which company employees are mentioned.

EMPLOYEES:
${employeeList}

CUSTOMER REVIEW:
"${reviewText}"

INSTRUCTIONS:
1. Identify any employees from the list who are mentioned in the review
2. Consider nicknames, variations, and context (e.g., "Mike" could match "Michael")
3. Only return exact matches from the employee list - use the primary name, not aliases
4. Be careful not to match company names, locations, or common words
5. Generic terms like "the tech", "the plumber", "your guy" do NOT count as mentions

Return ONLY a JSON object in this exact format:
{"mentioned": ["Name1", "Name2"]}

If no employees are mentioned, return:
{"mentioned": []}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('AI response did not contain valid JSON, falling back to regex');
      return findTeamMemberMentions(reviewText, teamMembers);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.mentioned)) {
      return findTeamMemberMentions(reviewText, teamMembers);
    }

    // Validate that all returned names are actually in our team member list
    const validNames = new Set(teamMembers.map(m => m.name));
    const validMentions = parsed.mentioned.filter((name: string) => validNames.has(name));

    return validMentions;
  } catch (error) {
    console.error('AI mention detection failed, falling back to regex:', error);
    return findTeamMemberMentions(reviewText, teamMembers);
  }
}

/**
 * Batch AI detection for multiple reviews (more efficient)
 * Processes up to 10 reviews at once to reduce API calls
 */
export async function findTeamMemberMentionsBatch(
  reviews: Array<{ reviewId: string; comment: string }>,
  teamMembers: TeamMember[]
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (reviews.length === 0 || teamMembers.length === 0) {
    return results;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    // Fallback to regex for all reviews
    for (const review of reviews) {
      results.set(review.reviewId, findTeamMemberMentions(review.comment, teamMembers));
    }
    return results;
  }

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const employeeList = teamMembers.map(m => {
        if (m.aliases && m.aliases.length > 0) {
          return `${m.name} (also known as: ${m.aliases.join(', ')})`;
        }
        return m.name;
      }).join('\n');

      const reviewsText = batch.map((r, idx) =>
        `REVIEW ${idx + 1} [ID: ${r.reviewId}]:\n"${r.comment}"`
      ).join('\n\n');

      const prompt = `You are analyzing customer reviews to identify which company employees are mentioned.

EMPLOYEES:
${employeeList}

${reviewsText}

INSTRUCTIONS:
1. For each review, identify any employees from the list who are mentioned
2. Consider nicknames, variations, and context
3. Only return exact matches from the employee list - use the primary name, not aliases
4. Be careful not to match company names, locations, or common words
5. Generic terms like "the tech", "the plumber" do NOT count as mentions

Return ONLY a JSON object in this exact format:
{
  "results": {
    "review_id_1": ["Name1", "Name2"],
    "review_id_2": [],
    ...
  }
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const validNames = new Set(teamMembers.map(m => m.name));

        for (const review of batch) {
          const mentions = parsed.results?.[review.reviewId];
          if (Array.isArray(mentions)) {
            results.set(review.reviewId, mentions.filter((name: string) => validNames.has(name)));
          } else {
            // Fallback to regex for this review
            results.set(review.reviewId, findTeamMemberMentions(review.comment, teamMembers));
          }
        }
      } else {
        // Fallback to regex for this batch
        for (const review of batch) {
          results.set(review.reviewId, findTeamMemberMentions(review.comment, teamMembers));
        }
      }
    } catch (error) {
      console.error('Batch AI detection failed, falling back to regex:', error);
      for (const review of batch) {
        results.set(review.reviewId, findTeamMemberMentions(review.comment, teamMembers));
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < reviews.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
