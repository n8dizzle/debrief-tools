/**
 * Master Leads - Utilities and reconciliation logic
 * Handles lead aggregation, matching, and ROI tracking
 */

import { createClient } from '@supabase/supabase-js';

// Types
export type LeadSource =
  | 'lsa'
  | 'gbp'
  | 'website'
  | 'organic'
  | 'direct'
  | 'angi'
  | 'thumbtack'
  | 'networx'
  | 'yelp'
  | 'st_call'
  | 'st_booking';

export type LeadType = 'call' | 'form' | 'booking' | 'message';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'booked'
  | 'completed'
  | 'lost'
  | 'invalid';

export type ReconciliationStatus =
  | 'pending'
  | 'auto_matched'
  | 'manual_matched'
  | 'no_match'
  | 'duplicate';

export type MatchRule =
  | 'tracking_number'
  | 'phone_time'
  | 'campaign'
  | 'time_only'
  | 'manual';

export interface STCall {
  id: string;
  st_call_id: string;
  direction: string;
  call_type: string;
  duration_seconds: number;
  customer_id: number | null;
  job_id: number | null;
  booking_id: number | null;
  from_phone: string | null;
  to_phone: string | null;
  tracking_number: string | null;
  campaign_id: number | null;
  campaign_name: string | null;
  agent_id: number | null;
  agent_name: string | null;
  recording_url: string | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  received_at: string;
  answered_at: string | null;
  ended_at: string | null;
  synced_at: string;
  updated_at: string;
}

export interface LSALead {
  id: string;
  google_lead_id: string;
  customer_id: string;
  lead_type: string;
  category_id: string | null;
  service_id: string | null;
  trade: string | null;
  phone_number: string | null;
  consumer_phone_number: string | null;
  lead_status: string;
  lead_charged: boolean;
  credit_state: string | null;
  credit_state_updated_at: string | null;
  lead_created_at: string;
  locale: string | null;
  call_duration_seconds: number | null;
  call_recording_url: string | null;
  message_text: string | null;
  synced_at: string;
  updated_at: string;
}

export interface MasterLead {
  id: string;
  lsa_lead_id: string | null;
  st_call_id: string | null;
  aggregator_lead_id: string | null;
  original_source: LeadSource;
  original_source_id: string | null;
  primary_source: LeadSource;
  primary_source_detail: string | null;
  source_confidence: number;
  phone: string | null;
  phone_normalized: string | null;
  customer_name: string | null;
  lead_type: LeadType;
  trade: string | null;
  lead_status: LeadStatus;
  is_qualified: boolean;
  is_booked: boolean;
  is_completed: boolean;
  st_customer_id: number | null;
  st_job_id: number | null;
  st_booking_id: number | null;
  job_revenue: number | null;
  job_completed_at: string | null;
  lead_cost: number | null;
  reconciliation_status: ReconciliationStatus;
  reconciliation_confidence: number | null;
  reconciliation_rule: MatchRule | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  is_duplicate: boolean;
  duplicate_of_id: string | null;
  lead_created_at: string;
  created_at: string;
  updated_at: string;
}

export interface SourceMapping {
  id: string;
  identifier_type: string;
  identifier_value: string;
  source: LeadSource;
  source_detail: string | null;
  trade: string | null;
  is_active: boolean;
}

export interface MatchResult {
  matched: boolean;
  rule: MatchRule | null;
  confidence: number;
  stCallId: string | null;
  matchDetails: string;
}

// Utility functions

/**
 * Normalize phone number for matching
 * Removes all non-digit characters
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^0-9]/g, '');
  // Return last 10 digits (US format) if longer
  if (normalized.length > 10) {
    return normalized.slice(-10);
  }
  return normalized || null;
}

/**
 * Check if two phone numbers match (normalized comparison)
 */
export function phonesMatch(phone1: string | null, phone2: string | null): boolean {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

/**
 * Check if two timestamps are within a time window
 */
export function withinTimeWindow(
  time1: string | Date,
  time2: string | Date,
  windowMinutes: number
): boolean {
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  const diffMinutes = Math.abs(t1 - t2) / (1000 * 60);
  return diffMinutes <= windowMinutes;
}

/**
 * Determine trade from category ID (LSA format)
 */
export function getTradeFromCategoryId(categoryId: string | null): string | null {
  if (!categoryId) return null;
  const lower = categoryId.toLowerCase();
  if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling') || lower.includes('air_condition')) {
    return 'HVAC';
  }
  if (lower.includes('plumb') || lower.includes('drain') || lower.includes('water_heater')) {
    return 'Plumbing';
  }
  return 'Other';
}

/**
 * Determine lead type from LSA lead type or call type
 */
export function getLeadType(lsaLeadType: string | null, stCallType?: string): LeadType {
  if (lsaLeadType) {
    const lower = lsaLeadType.toLowerCase();
    if (lower.includes('phone') || lower.includes('call')) return 'call';
    if (lower.includes('message')) return 'message';
    if (lower.includes('booking')) return 'booking';
    return 'form';
  }
  // ST calls are always calls
  return 'call';
}

/**
 * Match an LSA lead to ST calls using matching rules
 * Returns the best match or no match
 */
export async function matchLsaLeadToStCalls(
  lsaLead: LSALead,
  stCalls: STCall[],
  sourceMappings: SourceMapping[]
): Promise<MatchResult> {
  const lsaPhone = normalizePhone(lsaLead.consumer_phone_number || lsaLead.phone_number);
  const lsaTime = new Date(lsaLead.lead_created_at);

  // Filter to inbound calls only (leads come from inbound)
  const inboundCalls = stCalls.filter((c) => c.direction === 'Inbound');

  // Rule 1: Tracking number match (95% confidence)
  if (lsaPhone) {
    const trackingMapping = sourceMappings.find(
      (m) =>
        m.identifier_type === 'tracking_number' &&
        m.source === 'lsa' &&
        m.is_active
    );

    if (trackingMapping) {
      const matchingCall = inboundCalls.find(
        (c) =>
          c.tracking_number === trackingMapping.identifier_value &&
          withinTimeWindow(c.received_at, lsaTime, 15)
      );

      if (matchingCall) {
        return {
          matched: true,
          rule: 'tracking_number',
          confidence: 95,
          stCallId: matchingCall.id,
          matchDetails: `Matched via tracking number ${trackingMapping.identifier_value}`,
        };
      }
    }
  }

  // Rule 2: Phone + time correlation (90% confidence)
  if (lsaPhone) {
    const phoneTimeMatch = inboundCalls.find(
      (c) => phonesMatch(c.from_phone, lsaPhone) && withinTimeWindow(c.received_at, lsaTime, 15)
    );

    if (phoneTimeMatch) {
      return {
        matched: true,
        rule: 'phone_time',
        confidence: 90,
        stCallId: phoneTimeMatch.id,
        matchDetails: `Matched via phone ${lsaPhone} within 15 min`,
      };
    }
  }

  // Rule 3: Campaign name match (80% confidence)
  // Look for LSA-related campaign names in ST
  const lsaCampaignMatch = inboundCalls.find(
    (c) =>
      c.campaign_name &&
      (c.campaign_name.toLowerCase().includes('lsa') ||
        c.campaign_name.toLowerCase().includes('local service')) &&
      withinTimeWindow(c.received_at, lsaTime, 30)
  );

  if (lsaCampaignMatch) {
    return {
      matched: true,
      rule: 'campaign',
      confidence: 80,
      stCallId: lsaCampaignMatch.id,
      matchDetails: `Matched via campaign "${lsaCampaignMatch.campaign_name}"`,
    };
  }

  // Rule 4: Time-only correlation (60% confidence) - same trade, within 5 minutes
  // This is lower confidence and should be flagged for review
  const lsaTrade = getTradeFromCategoryId(lsaLead.category_id);
  if (lsaTrade) {
    const timeOnlyMatch = inboundCalls.find(
      (c) =>
        withinTimeWindow(c.received_at, lsaTime, 5) &&
        // Business unit heuristic - HVAC units for HVAC leads, etc.
        (lsaTrade === 'HVAC'
          ? c.business_unit_name?.toLowerCase().includes('hvac')
          : lsaTrade === 'Plumbing'
            ? c.business_unit_name?.toLowerCase().includes('plumb')
            : true)
    );

    if (timeOnlyMatch) {
      return {
        matched: true,
        rule: 'time_only',
        confidence: 60,
        stCallId: timeOnlyMatch.id,
        matchDetails: `Matched via time proximity (${lsaTrade} trade)`,
      };
    }
  }

  // No match found
  return {
    matched: false,
    rule: null,
    confidence: 0,
    stCallId: null,
    matchDetails: 'No matching ST call found',
  };
}

/**
 * Create a master lead record from an LSA lead
 */
export function createMasterLeadFromLsa(
  lsaLead: LSALead,
  matchResult?: MatchResult
): Partial<MasterLead> {
  const trade = getTradeFromCategoryId(lsaLead.category_id);
  const leadType = getLeadType(lsaLead.lead_type);

  return {
    lsa_lead_id: lsaLead.id,
    original_source: 'lsa',
    original_source_id: lsaLead.google_lead_id,
    primary_source: 'lsa', // LSA is authoritative for LSA leads
    primary_source_detail: `Google LSA - ${trade || 'Unknown'}`,
    source_confidence: 100, // LSA data is always trusted
    phone: lsaLead.consumer_phone_number || lsaLead.phone_number,
    lead_type: leadType,
    trade,
    lead_status: lsaLead.lead_charged ? 'qualified' : 'new',
    is_qualified: lsaLead.lead_charged,
    is_booked: lsaLead.lead_status === 'BOOKED',
    is_completed: false, // Will be updated after reconciliation
    lead_cost: lsaLead.lead_charged ? null : 0, // Cost comes from lsa_daily_performance
    reconciliation_status: matchResult?.matched ? 'auto_matched' : 'pending',
    reconciliation_confidence: matchResult?.confidence || null,
    reconciliation_rule: matchResult?.rule || null,
    reconciled_at: matchResult?.matched ? new Date().toISOString() : null,
    is_duplicate: false,
    lead_created_at: lsaLead.lead_created_at,
  };
}

/**
 * Create a master lead record from an ST call (no external source)
 */
export function createMasterLeadFromStCall(stCall: STCall): Partial<MasterLead> {
  // Determine source from campaign or default to organic
  let source: LeadSource = 'organic';
  let sourceDetail = 'Organic / Direct Call';

  if (stCall.campaign_name) {
    const campaignLower = stCall.campaign_name.toLowerCase();
    if (campaignLower.includes('website') || campaignLower.includes('web')) {
      source = 'website';
      sourceDetail = `Website - ${stCall.campaign_name}`;
    } else if (campaignLower.includes('gbp') || campaignLower.includes('google business')) {
      source = 'gbp';
      sourceDetail = `Google Business Profile`;
    } else if (campaignLower.includes('lsa') || campaignLower.includes('local service')) {
      source = 'lsa';
      sourceDetail = `Google LSA`;
    } else {
      sourceDetail = stCall.campaign_name;
    }
  }

  // Determine trade from business unit
  let trade: string | null = null;
  if (stCall.business_unit_name) {
    const buLower = stCall.business_unit_name.toLowerCase();
    if (buLower.includes('hvac') || buLower.includes('air')) {
      trade = 'HVAC';
    } else if (buLower.includes('plumb')) {
      trade = 'Plumbing';
    }
  }

  return {
    st_call_id: stCall.id,
    original_source: 'st_call',
    original_source_id: stCall.st_call_id,
    primary_source: source,
    primary_source_detail: sourceDetail,
    source_confidence: stCall.campaign_name ? 70 : 50, // Lower confidence without external verification
    phone: stCall.from_phone,
    customer_name: null, // Will be filled from customer lookup
    lead_type: 'call',
    trade,
    lead_status: stCall.job_id ? 'booked' : stCall.booking_id ? 'booked' : 'new',
    is_qualified: stCall.call_type === 'Booked',
    is_booked: !!stCall.booking_id || !!stCall.job_id,
    is_completed: false,
    st_customer_id: stCall.customer_id,
    st_job_id: stCall.job_id,
    st_booking_id: stCall.booking_id,
    lead_cost: 0, // Organic/direct calls have no cost
    reconciliation_status: 'no_match', // Already an ST call, no external match needed
    is_duplicate: false,
    lead_created_at: stCall.received_at,
  };
}

// Dashboard metrics

export interface LeadMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  bookedLeads: number;
  completedLeads: number;
  totalRevenue: number;
  totalSpend: number;
  cpa: number;
  conversionRate: number;
  roi: number;
}

export interface LeadMetricsBySource {
  source: string;
  metrics: LeadMetrics;
}

/**
 * Calculate lead metrics from master leads
 */
export function calculateLeadMetrics(leads: MasterLead[]): LeadMetrics {
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.is_qualified).length;
  const bookedLeads = leads.filter((l) => l.is_booked).length;
  const completedLeads = leads.filter((l) => l.is_completed).length;
  const totalRevenue = leads.reduce((sum, l) => sum + (l.job_revenue || 0), 0);
  const totalSpend = leads.reduce((sum, l) => sum + (l.lead_cost || 0), 0);
  const cpa = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const conversionRate = totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0;
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  return {
    totalLeads,
    qualifiedLeads,
    bookedLeads,
    completedLeads,
    totalRevenue,
    totalSpend,
    cpa,
    conversionRate,
    roi,
  };
}

/**
 * Group and calculate metrics by source
 */
export function calculateMetricsBySource(leads: MasterLead[]): LeadMetricsBySource[] {
  const grouped = new Map<string, MasterLead[]>();

  for (const lead of leads) {
    const source = lead.primary_source;
    if (!grouped.has(source)) {
      grouped.set(source, []);
    }
    grouped.get(source)!.push(lead);
  }

  const results: LeadMetricsBySource[] = [];
  for (const [source, sourceLeads] of grouped) {
    results.push({
      source,
      metrics: calculateLeadMetrics(sourceLeads),
    });
  }

  // Sort by total leads descending
  return results.sort((a, b) => b.metrics.totalLeads - a.metrics.totalLeads);
}

// Supabase client factory
let _supabase: ReturnType<typeof createClient> | null = null;

export function getLeadsSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}
