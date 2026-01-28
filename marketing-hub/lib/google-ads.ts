/**
 * Google Ads API client for Local Service Ads data.
 * Fetches LSA leads and performance metrics.
 */

import { GoogleAdsApi, enums } from 'google-ads-api';

export interface LSALead {
  id: string;
  leadType: string;
  categoryId: string;
  serviceName: string;
  contactDetails: {
    phoneNumber?: string;
    consumerPhoneNumber?: string;
  };
  leadStatus: string;
  creationDateTime: string;
  locale: string;
  leadCharged: boolean;
  creditDetails?: {
    creditState: string;
    creditStateLastUpdateDateTime?: string;
  };
  customerId?: string; // Which account the lead came from
}

export interface LSALeadConversation {
  leadId: string;
  participantType: string;
  messageText?: string;
  eventDateTime: string;
  phoneCallDetails?: {
    callDurationMillis: string;
    callRecordingUrl?: string;
  };
}

export interface LSAPerformance {
  customerId: string;
  customerName: string;
  impressions: number;
  clicks: number;
  totalLeads: number;
  chargedLeads: number;
  cost: number;
  costPerLead: number;
  messageLeads: number;
  phoneLeads: number;
  period: string;
}

export interface LSALocation {
  customerId: string;
  locationName: string;
  category: string;
  businessName?: string;
}

class GoogleAdsClient {
  private client: GoogleAdsApi | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!developerToken || !clientId || !clientSecret || !refreshToken) {
      console.warn('Google Ads API credentials not configured');
      return;
    }

    try {
      this.client = new GoogleAdsApi({
        client_id: clientId,
        client_secret: clientSecret,
        developer_token: developerToken,
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Ads client:', error);
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  private getCustomer(customerId?: string) {
    if (!this.client) {
      throw new Error('Google Ads client not configured');
    }

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!loginCustomerId || !refreshToken) {
      throw new Error('Missing login customer ID or refresh token');
    }

    // Use the specified customerId or fall back to login customer ID
    const targetCustomerId = customerId || loginCustomerId;

    return this.client.Customer({
      customer_id: targetCustomerId,
      login_customer_id: loginCustomerId,
      refresh_token: refreshToken,
    });
  }

  /**
   * Get all accessible customer accounts (for LSA locations)
   */
  async getAccessibleCustomers(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Google Ads client not configured');
    }

    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    try {
      const customers = await this.client.listAccessibleCustomers(refreshToken);
      return customers.resource_names.map((name: string) => name.replace('customers/', ''));
    } catch (error) {
      console.error('Error fetching accessible customers:', error);
      throw error;
    }
  }

  /**
   * Get ALL LSA leads from all accessible accounts (no date filter)
   * Use this for syncing to database
   */
  async getAllLSALeads(): Promise<LSALead[]> {
    const customerIds = await this.getAccessibleCustomers();
    const allLeads: LSALead[] = [];
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    console.log(`[LSA] Querying ${customerIds.length} customer accounts for ALL leads`);

    for (const cid of customerIds) {
      try {
        const customer = this.getCustomer(cid);

        // NOTE: Do NOT request contact_details (phone numbers) - requires special PII permissions
        const query = `
          SELECT
            local_services_lead.id,
            local_services_lead.lead_type,
            local_services_lead.category_id,
            local_services_lead.service_id,
            local_services_lead.creation_date_time,
            local_services_lead.locale,
            local_services_lead.lead_status,
            local_services_lead.lead_charged,
            local_services_lead.credit_details.credit_state,
            local_services_lead.lead_feedback_submitted
          FROM local_services_lead
          ORDER BY local_services_lead.creation_date_time DESC
        `;

        const response = await customer.query(query);
        console.log(`[LSA] Customer ${cid}: Found ${response.length} leads`);

        const leads = response.map((row: any) => this.mapLeadResponse(row, cid));
        allLeads.push(...leads);
      } catch (error: any) {
        console.log(`[LSA] Customer ${cid} error: ${error.message?.substring(0, 200)}`);
      }
    }

    console.log(`[LSA] Total leads fetched: ${allLeads.length}`);

    // Sort by creation date, newest first
    allLeads.sort((a, b) =>
      new Date(b.creationDateTime).getTime() - new Date(a.creationDateTime).getTime()
    );

    return allLeads;
  }

  /**
   * Get LSA leads for a date range from all accessible accounts
   */
  async getLSALeads(
    startDate: string,
    endDate: string,
    customerId?: string
  ): Promise<LSALead[]> {
    const customerIds = customerId
      ? [customerId]
      : await this.getAccessibleCustomers();

    const allLeads: LSALead[] = [];

    console.log(`[LSA] Querying for leads (${startDate} to ${endDate})`);

    for (const cid of customerIds) {
      try {
        const customer = this.getCustomer(cid);

        // NOTE: Do NOT request contact_details (phone numbers) - requires special PII permissions
        const query = `
          SELECT
            local_services_lead.id,
            local_services_lead.lead_type,
            local_services_lead.category_id,
            local_services_lead.service_id,
            local_services_lead.creation_date_time,
            local_services_lead.locale,
            local_services_lead.lead_status,
            local_services_lead.lead_charged,
            local_services_lead.credit_details.credit_state,
            local_services_lead.lead_feedback_submitted
          FROM local_services_lead
          ORDER BY local_services_lead.creation_date_time DESC
        `;

        const response = await customer.query(query);
        const leads = response.map((row: any) => this.mapLeadResponse(row, cid));
        allLeads.push(...leads);
      } catch (error: any) {
        // Silent fail for accounts without LSA
      }
    }

    // Filter by date client-side
    const startDateTime = new Date(startDate + 'T00:00:00');
    const endDateTime = new Date(endDate + 'T23:59:59');

    const filteredLeads = allLeads.filter(lead => {
      const leadDate = new Date(lead.creationDateTime);
      return leadDate >= startDateTime && leadDate <= endDateTime;
    });

    filteredLeads.sort((a, b) =>
      new Date(b.creationDateTime).getTime() - new Date(a.creationDateTime).getTime()
    );

    return filteredLeads;
  }

  private mapLeadResponse(row: any, customerId: string): LSALead {
    return {
      id: row.local_services_lead?.id?.toString() || '',
      leadType: this.mapLeadType(row.local_services_lead?.lead_type),
      categoryId: row.local_services_lead?.category_id || '',
      serviceName: row.local_services_lead?.service_id || '',
      contactDetails: {
        // Phone numbers require PII permissions - not available without special access
        phoneNumber: '',
        consumerPhoneNumber: '',
      },
      leadStatus: this.mapLeadStatus(row.local_services_lead?.lead_status),
      creationDateTime: row.local_services_lead?.creation_date_time || '',
      locale: row.local_services_lead?.locale || '',
      leadCharged: row.local_services_lead?.lead_charged || false,
      creditDetails: row.local_services_lead?.credit_details ? {
        creditState: row.local_services_lead.credit_details.credit_state || '',
        creditStateLastUpdateDateTime: '',
      } : undefined,
      customerId,
    };
  }

  // Map numeric lead_type to string
  private mapLeadType(type: number | string): string {
    const types: Record<number, string> = {
      0: 'UNSPECIFIED',
      1: 'UNKNOWN',
      2: 'MESSAGE',
      3: 'PHONE_CALL',
      4: 'BOOKING',
    };
    if (typeof type === 'number') {
      return types[type] || 'UNKNOWN';
    }
    return type || 'UNKNOWN';
  }

  // Map numeric lead_status to string
  private mapLeadStatus(status: number | string): string {
    const statuses: Record<number, string> = {
      0: 'UNSPECIFIED',
      1: 'UNKNOWN',
      2: 'NEW',
      3: 'ACTIVE',
      4: 'BOOKED',
      5: 'DECLINED',
      6: 'EXPIRED',
      7: 'DISABLED',
      8: 'CONSUMER_DECLINED',
      9: 'WIPED_OUT',
    };
    if (typeof status === 'number') {
      return statuses[status] || 'UNKNOWN';
    }
    return status || 'UNKNOWN';
  }

  /**
   * Get LSA lead conversations (call recordings, messages)
   */
  async getLSAConversations(
    leadId: string
  ): Promise<LSALeadConversation[]> {
    const customer = this.getCustomer();

    try {
      const query = `
        SELECT
          local_services_lead_conversation.id,
          local_services_lead_conversation.conversation_channel,
          local_services_lead_conversation.participant_type,
          local_services_lead_conversation.lead,
          local_services_lead_conversation.event_date_time,
          local_services_lead_conversation.phone_call_details.call_duration_millis,
          local_services_lead_conversation.phone_call_details.call_recording_url,
          local_services_lead_conversation.message_details.text
        FROM local_services_lead_conversation
        WHERE local_services_lead_conversation.lead = 'customers/${process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID}/localServicesLeads/${leadId}'
        ORDER BY local_services_lead_conversation.event_date_time ASC
      `;

      const response = await customer.query(query);

      return response.map((row: any) => ({
        leadId: leadId,
        participantType: row.local_services_lead_conversation?.participant_type || '',
        messageText: row.local_services_lead_conversation?.message_details?.text || '',
        eventDateTime: row.local_services_lead_conversation?.event_date_time || '',
        phoneCallDetails: row.local_services_lead_conversation?.phone_call_details ? {
          callDurationMillis: row.local_services_lead_conversation.phone_call_details.call_duration_millis || '0',
          callRecordingUrl: row.local_services_lead_conversation.phone_call_details.call_recording_url || '',
        } : undefined,
      }));
    } catch (error) {
      console.error('Error fetching LSA conversations:', error);
      throw error;
    }
  }

  /**
   * Get LSA performance metrics from all accessible accounts
   */
  async getLSAPerformance(
    startDate: string,
    endDate: string
  ): Promise<LSAPerformance[]> {
    const customerIds = await this.getAccessibleCustomers();
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const performanceMap = new Map<string, LSAPerformance>();

    for (const cid of customerIds) {
      // Skip the manager account itself
      if (cid === loginCustomerId) continue;

      try {
        const customer = this.getCustomer(cid);
        // Get campaign performance for Local Services campaigns
        const query = `
          SELECT
            customer.id,
            customer.descriptive_name,
            campaign.id,
            campaign.name,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.all_conversions,
            metrics.phone_calls
          FROM campaign
          WHERE campaign.advertising_channel_type = 'LOCAL_SERVICES'
            AND segments.date >= '${startDate}'
            AND segments.date <= '${endDate}'
        `;

        const response = await customer.query(query);

        // Aggregate by customer
        for (const row of response) {
          const customerId = row.customer?.id?.toString() || '';
          const existing = performanceMap.get(customerId) || {
            customerId,
            customerName: row.customer?.descriptive_name || '',
            impressions: 0,
            clicks: 0,
            totalLeads: 0,
            chargedLeads: 0,
            cost: 0,
            costPerLead: 0,
            messageLeads: 0,
            phoneLeads: 0,
            period: `${startDate} to ${endDate}`,
          };

          existing.impressions += Number(row.metrics?.impressions || 0);
          existing.clicks += Number(row.metrics?.clicks || 0);
          existing.cost += Number(row.metrics?.cost_micros || 0) / 1000000; // Convert micros to dollars
          existing.phoneLeads += Number(row.metrics?.phone_calls || 0);
          existing.totalLeads += Number(row.metrics?.all_conversions || 0);

          performanceMap.set(customerId, existing);
        }
      } catch (error: any) {
        // Some accounts may not have LSA campaigns - that's expected
        if (!error.message?.includes('LOCAL_SERVICES') &&
            !error.message?.includes('UNIMPLEMENTED')) {
          console.error(`Error fetching LSA performance for customer ${cid}:`, error.message);
        }
      }
    }

    // Calculate cost per lead
    const results = Array.from(performanceMap.values());
    for (const perf of results) {
      perf.costPerLead = perf.totalLeads > 0 ? perf.cost / perf.totalLeads : 0;
    }

    return results;
  }

  /**
   * Get LSA verification status
   */
  async getLSAVerificationStatus(): Promise<any[]> {
    const customer = this.getCustomer();

    try {
      const query = `
        SELECT
          local_services_verification_artifact.id,
          local_services_verification_artifact.creation_date_time,
          local_services_verification_artifact.status,
          local_services_verification_artifact.artifact_type,
          local_services_verification_artifact.background_check_verification_artifact.case_url,
          local_services_verification_artifact.insurance_verification_artifact.amount_micros,
          local_services_verification_artifact.license_verification_artifact.license_type,
          local_services_verification_artifact.license_verification_artifact.license_number
        FROM local_services_verification_artifact
        LIMIT 100
      `;

      const response = await customer.query(query);
      return response;
    } catch (error) {
      console.error('Error fetching LSA verification status:', error);
      throw error;
    }
  }
}

// Singleton instance
let _client: GoogleAdsClient | null = null;

export function getGoogleAdsClient(): GoogleAdsClient {
  if (!_client) {
    _client = new GoogleAdsClient();
  }
  return _client;
}

/**
 * Format lead type enum to readable string
 */
export function formatLeadType(leadType: string): string {
  const types: Record<string, string> = {
    'MESSAGE': 'Message',
    'PHONE_CALL': 'Phone Call',
    'BOOKING': 'Booking',
    'UNKNOWN': 'Unknown',
    'UNSPECIFIED': 'Unspecified',
  };
  return types[leadType] || leadType;
}

/**
 * Format lead status enum to readable string
 */
export function formatLeadStatus(status: string): string {
  const statuses: Record<string, string> = {
    'NEW': 'New',
    'ACTIVE': 'Active',
    'BOOKED': 'Booked',
    'DECLINED': 'Declined',
    'EXPIRED': 'Expired',
    'DISABLED': 'Disabled',
    'CONSUMER_DECLINED': 'Customer Declined',
    'WIPED_OUT': 'Removed',
    'UNKNOWN': 'Unknown',
    'UNSPECIFIED': 'Unspecified',
  };
  return statuses[status] || status;
}

/**
 * Format credit state enum to readable string
 */
export function formatCreditState(state: string): string {
  const states: Record<string, string> = {
    'PENDING': 'Pending',
    'CREDITED': 'Credited',
    'CREDIT_REQUESTED': 'Credit Requested',
    'CREDIT_DENIED': 'Credit Denied',
    'NOT_CREDITED': 'Not Credited',
    'UNKNOWN': 'Unknown',
    'UNSPECIFIED': 'Unspecified',
  };
  return states[state] || state;
}

/**
 * Categorize a lead as HVAC, Plumbing, or Other based on category_id
 */
export function getLeadTrade(categoryId: string): 'HVAC' | 'Plumbing' | 'Other' {
  const lowerCategory = categoryId.toLowerCase();
  if (lowerCategory.includes('hvac') ||
      lowerCategory.includes('heating') ||
      lowerCategory.includes('air_conditioning') ||
      lowerCategory.includes('air-conditioning')) {
    return 'HVAC';
  }
  if (lowerCategory.includes('plumb') ||
      lowerCategory.includes('drain') ||
      lowerCategory.includes('sewer') ||
      lowerCategory.includes('water_heater')) {
    return 'Plumbing';
  }
  return 'Other';
}

/**
 * Format category ID to readable name
 */
export function formatCategoryId(categoryId: string): string {
  if (!categoryId) return 'Unknown';

  // Extract the readable part from xcat:service_area_business_hvac format
  let name = categoryId
    .replace('xcat:service_area_business_', '')
    .replace('xcat:', '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');

  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, char => char.toUpperCase());

  // Common replacements
  name = name.replace(/Hvac/g, 'HVAC');
  name = name.replace(/Ac /g, 'AC ');

  return name;
}
