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

  private getCustomer() {
    if (!this.client) {
      throw new Error('Google Ads client not configured');
    }

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!loginCustomerId || !refreshToken) {
      throw new Error('Missing login customer ID or refresh token');
    }

    return this.client.Customer({
      customer_id: loginCustomerId,
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
   * Get LSA leads for a date range
   */
  async getLSALeads(
    startDate: string,
    endDate: string,
    customerId?: string
  ): Promise<LSALead[]> {
    const customer = this.getCustomer();
    const targetCustomerId = customerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    try {
      const query = `
        SELECT
          local_services_lead.id,
          local_services_lead.lead_type,
          local_services_lead.category_id,
          local_services_lead.service_id,
          local_services_lead.contact_details.phone_number,
          local_services_lead.contact_details.consumer_phone_number,
          local_services_lead.lead_status,
          local_services_lead.creation_date_time,
          local_services_lead.locale,
          local_services_lead.lead_charged,
          local_services_lead.credit_details.credit_state,
          local_services_lead.credit_details.credit_state_last_update_date_time
        FROM local_services_lead
        WHERE local_services_lead.creation_date_time >= '${startDate}'
          AND local_services_lead.creation_date_time <= '${endDate}'
        ORDER BY local_services_lead.creation_date_time DESC
        LIMIT 1000
      `;

      const response = await customer.query(query);

      return response.map((row: any) => ({
        id: row.local_services_lead?.id?.toString() || '',
        leadType: row.local_services_lead?.lead_type || '',
        categoryId: row.local_services_lead?.category_id || '',
        serviceName: row.local_services_lead?.service_id || '',
        contactDetails: {
          phoneNumber: row.local_services_lead?.contact_details?.phone_number || '',
          consumerPhoneNumber: row.local_services_lead?.contact_details?.consumer_phone_number || '',
        },
        leadStatus: row.local_services_lead?.lead_status || '',
        creationDateTime: row.local_services_lead?.creation_date_time || '',
        locale: row.local_services_lead?.locale || '',
        leadCharged: row.local_services_lead?.lead_charged || false,
        creditDetails: row.local_services_lead?.credit_details ? {
          creditState: row.local_services_lead.credit_details.credit_state || '',
          creditStateLastUpdateDateTime: row.local_services_lead.credit_details.credit_state_last_update_date_time || '',
        } : undefined,
      }));
    } catch (error) {
      console.error('Error fetching LSA leads:', error);
      throw error;
    }
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
   * Get LSA performance metrics
   */
  async getLSAPerformance(
    startDate: string,
    endDate: string
  ): Promise<LSAPerformance[]> {
    const customer = this.getCustomer();

    try {
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
      const performanceMap = new Map<string, LSAPerformance>();

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

      // Calculate cost per lead
      const results = Array.from(performanceMap.values());
      for (const perf of results) {
        perf.costPerLead = perf.totalLeads > 0 ? perf.cost / perf.totalLeads : 0;
      }

      return results;
    } catch (error) {
      console.error('Error fetching LSA performance:', error);
      throw error;
    }
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
