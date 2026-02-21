export type LeadType = 'TGL' | 'Marketed';

export type LeadStatus =
  | 'New Lead'
  | 'Assigned'
  | 'Quoted'
  | 'Sold'
  | 'Install Scheduled'
  | 'Completed';

export type UserRole = 'admin' | 'advisor';

export type SystemType = 'Gas' | 'Heat Pump' | 'Unknown';

export interface Lead {
  id: string;
  clientName: string;
  leadType: LeadType;
  source: string;
  techName?: string;
  status: LeadStatus;
  assignedAdvisor?: string;
  estimatedValue: number;
  grossMarginPercent: number;
  grossMarginDollar: number;
  createdDate: Date;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  serviceTitanId?: string;
  unitAge?: number;
  systemType?: SystemType;
}

export interface ComfortAdvisor {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  active: boolean;
  inQueue: boolean; // Whether advisor is in the round-robin queue
  tglQueuePosition: number;
  marketedQueuePosition: number;
  salesMTD: number;
  averageSale: number;
  closingRate: number;
  salesOpps: number;
  totalLeads: number;
  soldLeads: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface KPIData {
  totalSalesMTD: number;
  grossMarginMTD: number;
  grossMarginPercent: number;
  pipelineValue: number;
  avgClosingRate: number;
  activeLeads: number;
  newLeadsToday: number;
  soldToday: number;
}

// Slack Integration Types
export type MarketedLeadSource =
  | 'Google Ads'
  | 'Facebook'
  | 'Referral'
  | 'Website'
  | 'Direct Mail'
  | 'Other';

export interface MarketedLeadInput {
  customerName: string;
  phone: string;
  source: MarketedLeadSource;
  unitAge?: number;
  systemType?: SystemType;
  address?: string;
  notes?: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
}

export interface SlackNotificationPayload {
  lead: Lead;
  advisor: ComfortAdvisor;
  channel?: string;
}

export interface LeadAssignmentResult {
  lead: Lead;
  advisor: ComfortAdvisor;
}

// Service Titan Integration Types
export interface ServiceTitanConfig {
  clientId: string;
  clientSecret: string;
  appKey: string;
  tenantId: string;
  environment: 'integration' | 'production';
}

export type ServiceTitanSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'weekToDate'
  | 'last7'
  | 'last14'
  | 'last30'
  | 'mtd'
  | 'lastMonth'
  | 'last90'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'quarterToDate'
  | 'ytd'
  | 'last365'
  | 'lastYear'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: Date;
  endDate: Date;
}
