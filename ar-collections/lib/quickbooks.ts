/**
 * QuickBooks Online API client for fetching payments and deposits.
 * Uses OAuth 2.0 for authentication with automatic token refresh.
 *
 * Setup required:
 * 1. Create app at https://developer.intuit.com
 * 2. Set environment variables:
 *    - QUICKBOOKS_CLIENT_ID
 *    - QUICKBOOKS_CLIENT_SECRET
 *    - QUICKBOOKS_REDIRECT_URI
 *    - QUICKBOOKS_ENVIRONMENT (sandbox | production)
 */

import { getServerSupabase } from './supabase';

// ============================================
// TYPES
// ============================================

export interface QBCredentials {
  id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  refresh_token_expires_at: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface QBPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  CustomerRef?: {
    value: string;
    name?: string;
  };
  PaymentMethodRef?: {
    value: string;
    name?: string;
  };
  DepositToAccountRef?: {
    value: string;
    name?: string;
  };
  PrivateNote?: string;
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QBPaymentQueryResponse {
  QueryResponse: {
    Payment?: QBPayment[];
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
}

export interface QBDeposit {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  DepositToAccountRef?: {
    value: string;
    name?: string;
  };
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
    DepositLineDetail?: {
      PaymentMethodRef?: {
        value: string;
        name?: string;
      };
    };
  }>;
  PrivateNote?: string;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QBAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Active: boolean;
}

export interface QBCompanyInfo {
  CompanyName: string;
  LegalName?: string;
  Country?: string;
}

// ============================================
// QUICKBOOKS CLIENT CLASS
// ============================================

export class QuickBooksClient {
  private credentials: QBCredentials | null = null;
  private baseUrl: string;

  constructor() {
    const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
    this.baseUrl = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  /**
   * Get OAuth authorization URL for user to grant access
   */
  static getAuthUrl(state?: string): string {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim();
    const environment = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox').trim();

    if (!clientId || !redirectUri) {
      throw new Error('QuickBooks credentials not configured');
    }

    console.log('[QuickBooks Auth] Generating URL with clientId:', clientId.substring(0, 10) + '...');
    console.log('[QuickBooks Auth] Redirect URI:', redirectUri);

    const baseAuthUrl = environment === 'production'
      ? 'https://appcenter.intuit.com/connect/oauth2'
      : 'https://appcenter.intuit.com/connect/oauth2';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting openid profile email',
      state: state || 'ar-collections',
    });

    return `${baseAuthUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string, realmId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  }> {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('QuickBooks credentials not configured');
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[QuickBooks] Token exchange failed:', error);
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Load credentials from database
   */
  async loadCredentials(): Promise<boolean> {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('ar_quickbooks_credentials')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      this.credentials = null;
      return false;
    }

    this.credentials = data as QBCredentials;
    return true;
  }

  /**
   * Check if connected to QuickBooks
   */
  isConnected(): boolean {
    return this.credentials !== null;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    companyName: string | null;
    realmId: string | null;
    tokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
  } {
    if (!this.credentials) {
      return {
        connected: false,
        companyName: null,
        realmId: null,
        tokenExpiresAt: null,
        refreshTokenExpiresAt: null,
      };
    }

    return {
      connected: true,
      companyName: this.credentials.company_name,
      realmId: this.credentials.realm_id,
      tokenExpiresAt: this.credentials.token_expires_at,
      refreshTokenExpiresAt: this.credentials.refresh_token_expires_at,
    };
  }

  /**
   * Ensure access token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<string> {
    if (!this.credentials) {
      throw new Error('Not connected to QuickBooks');
    }

    const now = new Date();
    const tokenExpires = new Date(this.credentials.token_expires_at);

    // Refresh if token expires in less than 5 minutes
    if (tokenExpires.getTime() - now.getTime() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.credentials.access_token;
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.credentials) {
      throw new Error('No credentials to refresh');
    }

    const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log('[QuickBooks] Refreshing access token...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[QuickBooks] Token refresh failed:', error);
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    // Calculate expiry times
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + data.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + data.x_refresh_token_expires_in * 1000);

    // Update in database
    const supabase = getServerSupabase();
    const { error: updateError } = await supabase
      .from('ar_quickbooks_credentials')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expires_at: tokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.credentials.id);

    if (updateError) {
      console.error('[QuickBooks] Failed to save refreshed tokens:', updateError);
      throw new Error('Failed to save refreshed tokens');
    }

    // Update local credentials
    this.credentials.access_token = data.access_token;
    this.credentials.refresh_token = data.refresh_token;
    this.credentials.token_expires_at = tokenExpiresAt.toISOString();
    this.credentials.refresh_token_expires_at = refreshTokenExpiresAt.toISOString();

    console.log('[QuickBooks] Access token refreshed successfully');
  }

  /**
   * Make authenticated API request to QuickBooks
   */
  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: object
  ): Promise<T> {
    const accessToken = await this.ensureValidToken();

    if (!this.credentials) {
      throw new Error('Not connected to QuickBooks');
    }

    // Add minorversion parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}/v3/company/${this.credentials.realm_id}/${endpoint}${separator}minorversion=65`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[QuickBooks] API error (${response.status}):`, error);
      throw new Error(`QuickBooks API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Test connection by fetching company info
   */
  async testConnection(): Promise<QBCompanyInfo> {
    const response = await this.apiRequest<{
      CompanyInfo: QBCompanyInfo;
    }>('companyinfo/' + this.credentials?.realm_id);

    return response.CompanyInfo;
  }

  /**
   * Get the Undeposited Funds account ID
   */
  async getUndepositedFundsAccountId(): Promise<string | null> {
    const query = `SELECT * FROM Account WHERE Name = 'Undeposited Funds'`;
    const response = await this.apiRequest<{
      QueryResponse: { Account?: QBAccount[] };
    }>(`query?query=${encodeURIComponent(query)}`);

    const accounts = response.QueryResponse.Account;
    if (accounts && accounts.length > 0) {
      return accounts[0].Id;
    }

    return null;
  }

  /**
   * Get all payments in Undeposited Funds
   */
  async getPaymentsInUndepositedFunds(): Promise<QBPayment[]> {
    // First, get the Undeposited Funds account ID
    const undepositedFundsId = await this.getUndepositedFundsAccountId();

    if (!undepositedFundsId) {
      console.warn('[QuickBooks] Could not find Undeposited Funds account');
      return [];
    }

    // Fetch all recent payments (DepositToAccountRef is not queryable, so we filter client-side)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const query = `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
    const response = await this.apiRequest<QBPaymentQueryResponse>(
      `query?query=${encodeURIComponent(query)}`
    );

    const allPayments = response.QueryResponse.Payment || [];

    // Filter to only payments in Undeposited Funds
    return allPayments.filter(payment =>
      payment.DepositToAccountRef?.value === undepositedFundsId
    );
  }

  /**
   * Get all payments (not filtered by account)
   */
  async getAllPayments(startDate?: string, endDate?: string): Promise<QBPayment[]> {
    let query = `SELECT * FROM Payment`;

    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }

    query += ` ORDERBY TxnDate DESC MAXRESULTS 1000`;

    const response = await this.apiRequest<QBPaymentQueryResponse>(
      `query?query=${encodeURIComponent(query)}`
    );

    return response.QueryResponse.Payment || [];
  }

  /**
   * Get recent deposits
   */
  async getDeposits(startDate?: string, endDate?: string): Promise<QBDeposit[]> {
    let query = `SELECT * FROM Deposit`;

    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }

    query += ` ORDERBY TxnDate DESC MAXRESULTS 1000`;

    const response = await this.apiRequest<{
      QueryResponse: { Deposit?: QBDeposit[] };
    }>(`query?query=${encodeURIComponent(query)}`);

    return response.QueryResponse.Deposit || [];
  }

  /**
   * Get a single payment by ID
   */
  async getPayment(paymentId: string): Promise<QBPayment> {
    const response = await this.apiRequest<{ Payment: QBPayment }>(
      `payment/${paymentId}`
    );
    return response.Payment;
  }

  /**
   * Disconnect from QuickBooks (delete stored credentials)
   */
  async disconnect(): Promise<void> {
    if (!this.credentials) {
      return;
    }

    const supabase = getServerSupabase();
    await supabase
      .from('ar_quickbooks_credentials')
      .delete()
      .eq('id', this.credentials.id);

    this.credentials = null;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let _client: QuickBooksClient | null = null;

export async function getQuickBooksClient(): Promise<QuickBooksClient> {
  if (!_client) {
    _client = new QuickBooksClient();
  }

  // Always try to load/refresh credentials
  await _client.loadCredentials();

  return _client;
}

/**
 * Check if QuickBooks is configured (environment variables set)
 */
export function isQuickBooksConfigured(): boolean {
  return !!(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
    process.env.QUICKBOOKS_CLIENT_SECRET?.trim() &&
    process.env.QUICKBOOKS_REDIRECT_URI?.trim()
  );
}
