// Service Titan API integration layer
import { Lead, ServiceTitanConfig } from '@/types';

// Auth endpoints differ by environment
const AUTH_ENDPOINTS = {
  integration: 'https://auth-integration.servicetitan.io/connect/token',
  production: 'https://auth.servicetitan.io/connect/token',
};

// API base URLs by environment
const API_ENDPOINTS = {
  integration: 'https://api-integration.servicetitan.io',
  production: 'https://api.servicetitan.io',
};

// Get Service Titan config from environment variables (server-side only)
export function getServiceTitanConfigFromEnv(): ServiceTitanConfig | null {
  const clientId = process.env.ST_CLIENT_ID;
  const clientSecret = process.env.ST_CLIENT_SECRET;
  const tenantId = process.env.ST_TENANT_ID;
  const appKey = process.env.ST_APP_KEY;
  const environment = (process.env.ST_ENVIRONMENT || 'production') as 'production' | 'integration';

  if (!clientId || !clientSecret || !tenantId || !appKey) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    appKey,
    tenantId,
    environment,
  };
}

// Check if Service Titan is configured via environment
export function isServiceTitanConfigured(): boolean {
  return !!(
    process.env.ST_CLIENT_ID &&
    process.env.ST_CLIENT_SECRET &&
    process.env.ST_TENANT_ID &&
    process.env.ST_APP_KEY
  );
}

interface TokenCache {
  accessToken: string;
  expiresAt: Date;
}

let tokenCache: TokenCache | null = null;

export async function authenticateServiceTitan(config: ServiceTitanConfig): Promise<string> {
  // Check if token is still valid (with 60 second buffer)
  if (tokenCache && tokenCache.expiresAt > new Date(Date.now() + 60000)) {
    return tokenCache.accessToken;
  }

  const authEndpoint = AUTH_ENDPOINTS[config.environment];

  // Service Titan requires x-www-form-urlencoded for auth
  const formData = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(authEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Service Titan authentication failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access token received from Service Titan');
  }

  // Token expires in 900 seconds (15 minutes) by default
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 900) * 1000),
  };

  return tokenCache.accessToken;
}

export function clearTokenCache(): void {
  tokenCache = null;
}

async function makeApiRequest(
  config: ServiceTitanConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await authenticateServiceTitan(config);
  const baseUrl = API_ENDPOINTS[config.environment];

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'ST-App-Key': config.appKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

export async function testConnection(config: ServiceTitanConfig): Promise<{ success: boolean; message: string }> {
  try {
    // First test authentication
    await authenticateServiceTitan(config);

    // Then test API access by fetching leads with a small page size
    const endpoint = `/crm/v2/tenant/${config.tenantId}/leads?page=1&pageSize=1`;
    const response = await makeApiRequest(config, endpoint);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    return { success: true, message: 'Successfully connected to Service Titan API' };
  } catch (error: any) {
    clearTokenCache();
    return { success: false, message: error.message || 'Connection failed' };
  }
}

export interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  status?: 'Open' | 'Dismissed' | 'Converted';
}

export async function syncLeadsFromServiceTitan(config: ServiceTitanConfig, options?: SyncOptions): Promise<Lead[]> {
  // Build query parameters
  const params = new URLSearchParams({
    page: '1',
    pageSize: '200',
  });

  // Add date filters if provided
  if (options?.startDate) {
    params.append('createdOnOrAfter', options.startDate.toISOString());
  }
  if (options?.endDate) {
    params.append('createdBefore', options.endDate.toISOString());
  }
  if (options?.status) {
    params.append('status', options.status);
  }

  const endpoint = `/crm/v2/tenant/${config.tenantId}/leads?${params.toString()}`;
  const response = await makeApiRequest(config, endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch leads from Service Titan: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Transform Service Titan leads to our Lead format
  return (data.data || []).map((stLead: any): Lead => ({
    id: `st-${stLead.id}`,
    clientName: stLead.leadCustomerName || 'Unknown Customer',
    leadType: 'Marketed', // Default to Marketed, can be adjusted based on campaign/source
    source: 'Service Titan',
    status: mapServiceTitanStatus(stLead.status),
    phone: stLead.leadPhone || '',
    email: stLead.leadEmail || undefined,
    address: formatServiceTitanAddress(stLead),
    createdDate: new Date(stLead.createdOn || Date.now()),
    serviceTitanId: stLead.id?.toString(),
    estimatedValue: 0, // Will be set when quoted
    grossMarginPercent: 40, // Default margin
    grossMarginDollar: 0,
  }));
}

function formatServiceTitanAddress(stLead: any): string {
  const parts = [
    stLead.leadStreet,
    stLead.leadUnit ? `Unit ${stLead.leadUnit}` : null,
    stLead.leadCity,
    stLead.leadState,
    stLead.leadZip,
  ].filter(Boolean);

  return parts.join(', ');
}

function mapServiceTitanStatus(stStatus: string): Lead['status'] {
  if (!stStatus) return 'New Lead';

  // Service Titan lead statuses: Open, Dismissed, Converted
  const statusMap: Record<string, Lead['status']> = {
    'Open': 'New Lead',
    'Dismissed': 'New Lead', // Keep dismissed as new since they may be re-opened
    'Converted': 'Assigned', // Converted to a job
  };

  return statusMap[stStatus] || 'New Lead';
}

export interface SoldEstimate {
  id: string;
  name: string;
  subtotal: number;
  soldOn: Date;
  soldById: string;
  soldByName?: string;
  customerId: string;
  jobId: string;
  businessUnitName: string;
  leadType: 'TGL' | 'Marketed';
}

export async function syncSoldEstimates(
  config: ServiceTitanConfig,
  options?: { startDate?: Date; endDate?: Date; soldById?: string }
): Promise<SoldEstimate[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '500',
  });

  if (options?.startDate) {
    params.append('soldAfter', options.startDate.toISOString().split('T')[0]);
  }
  if (options?.endDate) {
    params.append('soldBefore', options.endDate.toISOString().split('T')[0]);
  }

  const endpoint = `/sales/v2/tenant/${config.tenantId}/estimates?${params.toString()}`;
  const response = await makeApiRequest(config, endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch estimates: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Filter to only sold estimates
  let soldEstimates = (data.data || []).filter((est: any) => est.status?.name === 'Sold');

  // Filter by soldById client-side (API filter doesn't work reliably)
  if (options?.soldById) {
    soldEstimates = soldEstimates.filter((est: any) => est.soldBy?.toString() === options.soldById);
  }

  return soldEstimates.map((est: any): SoldEstimate => ({
    id: `est-${est.id}`,
    name: est.name || 'Estimate',
    subtotal: est.subtotal || 0,
    soldOn: new Date(est.soldOn),
    soldById: est.soldBy?.toString() || '',
    customerId: est.customerId?.toString() || '',
    jobId: est.jobId?.toString() || '',
    businessUnitName: est.businessUnitName || '',
    // Determine lead type: Sales business units are typically marketed, Service/Maintenance are often TGL
    leadType: est.businessUnitName?.toLowerCase().includes('sales') ? 'Marketed' : 'TGL',
  }));
}

export interface AdvisorSalesMetrics {
  advisorId: string;
  totalSales: number;
  averageSale: number;
  closeRate: number;
  salesOpps: number;
  soldCount: number;
  sales: SoldEstimate[];
}

export async function syncSalesDataForAdvisors(
  config: ServiceTitanConfig,
  advisorIds: string[],
  options?: { startDate?: Date; endDate?: Date }
): Promise<AdvisorSalesMetrics[]> {
  const results: AdvisorSalesMetrics[] = [];

  // First fetch ALL estimates to calculate opportunities and close rates
  const allEstimates = await fetchAllEstimates(config, options);

  for (const advisorId of advisorIds) {
    // The advisorId is already the raw ST ID (like "37214486")
    const stId = advisorId.replace('st-', '');

    try {
      // Filter estimates for this advisor (soldBy matches their ID)
      const advisorEstimates = allEstimates.filter(est => est.soldById === stId || est.createdById === stId);
      const soldEstimates = advisorEstimates.filter(est => est.status === 'Sold');

      const totalSales = soldEstimates.reduce((sum, sale) => sum + sale.subtotal, 0);
      const salesOpps = advisorEstimates.length;
      const soldCount = soldEstimates.length;
      const averageSale = soldCount > 0 ? totalSales / soldCount : 0;
      const closeRate = salesOpps > 0 ? (soldCount / salesOpps) * 100 : 0;

      results.push({
        advisorId,
        totalSales,
        averageSale,
        closeRate,
        salesOpps,
        soldCount,
        sales: soldEstimates.map(est => ({
          id: `est-${est.id}`,
          name: est.name,
          subtotal: est.subtotal,
          soldOn: est.soldOn,
          soldById: est.soldById,
          customerId: est.customerId,
          jobId: est.jobId,
          businessUnitName: est.businessUnitName,
          leadType: est.businessUnitName?.toLowerCase().includes('sales') ? 'Marketed' as const : 'TGL' as const,
        })),
      });
    } catch (error) {
      console.error(`Failed to fetch sales for advisor ${advisorId}:`, error);
      results.push({
        advisorId,
        totalSales: 0,
        averageSale: 0,
        closeRate: 0,
        salesOpps: 0,
        soldCount: 0,
        sales: [],
      });
    }
  }

  return results;
}

// Fetch all estimates (sold and unsold) for close rate calculation
async function fetchAllEstimates(
  config: ServiceTitanConfig,
  options?: { startDate?: Date; endDate?: Date }
): Promise<{ id: string; name: string; subtotal: number; soldOn: Date; soldById: string; createdById: string; customerId: string; jobId: string; businessUnitName: string; status: string }[]> {
  // Fetch sold estimates with soldAfter/soldBefore
  const soldParams = new URLSearchParams({
    page: '1',
    pageSize: '500',
  });

  if (options?.startDate) {
    soldParams.append('soldAfter', options.startDate.toISOString().split('T')[0]);
  }
  if (options?.endDate) {
    soldParams.append('soldBefore', options.endDate.toISOString().split('T')[0]);
  }

  const soldEndpoint = `/sales/v2/tenant/${config.tenantId}/estimates?${soldParams.toString()}`;
  const soldResponse = await makeApiRequest(config, soldEndpoint);

  if (!soldResponse.ok) {
    const errorText = await soldResponse.text();
    throw new Error(`Failed to fetch estimates: ${soldResponse.status} - ${errorText}`);
  }

  const soldData = await soldResponse.json();

  // Also fetch estimates created in the date range (for opportunities)
  const createdParams = new URLSearchParams({
    page: '1',
    pageSize: '500',
  });

  if (options?.startDate) {
    createdParams.append('createdOnOrAfter', options.startDate.toISOString().split('T')[0]);
  }
  if (options?.endDate) {
    createdParams.append('createdBefore', options.endDate.toISOString().split('T')[0]);
  }

  const createdEndpoint = `/sales/v2/tenant/${config.tenantId}/estimates?${createdParams.toString()}`;
  const createdResponse = await makeApiRequest(config, createdEndpoint);

  let allEstimates = soldData.data || [];

  if (createdResponse.ok) {
    const createdData = await createdResponse.json();
    // Merge, avoiding duplicates
    const soldIds = new Set(allEstimates.map((e: any) => e.id));
    for (const est of createdData.data || []) {
      if (!soldIds.has(est.id)) {
        allEstimates.push(est);
      }
    }
  }

  return allEstimates.map((est: any) => ({
    id: est.id?.toString() || '',
    name: est.name || 'Estimate',
    subtotal: est.subtotal || 0,
    soldOn: new Date(est.soldOn || est.createdOn),
    soldById: est.soldBy?.toString() || '',
    createdById: est.createdBy?.toString() || '',
    customerId: est.customerId?.toString() || '',
    jobId: est.jobId?.toString() || '',
    businessUnitName: est.businessUnitName || '',
    status: est.status?.name || '',
  }));
}

// Sync employees (Comfort Advisors) from Service Titan
export interface ServiceTitanEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
}

export async function syncEmployeesFromServiceTitan(
  config: ServiceTitanConfig,
  roleFilter?: string
): Promise<ServiceTitanEmployee[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '200',
    active: 'true',
  });

  const endpoint = `/settings/v2/tenant/${config.tenantId}/employees?${params.toString()}`;
  const response = await makeApiRequest(config, endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch employees from Service Titan: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  let employees = (data.data || []).map((emp: any): ServiceTitanEmployee => ({
    id: emp.id?.toString() || '',
    name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
    email: emp.email || '',
    phone: emp.phoneNumber || emp.phone || '',
    role: emp.role?.name || emp.roleName || emp.type || '',
    active: emp.active !== false,
  }));

  // Filter by role if specified (case-insensitive partial match)
  if (roleFilter) {
    const filterLower = roleFilter.toLowerCase();
    employees = employees.filter((emp: ServiceTitanEmployee) =>
      emp.role.toLowerCase().includes(filterLower)
    );
  }

  return employees;
}

// Sync technicians from Service Titan
export async function syncTechniciansFromServiceTitan(
  config: ServiceTitanConfig,
  teamFilter?: string
): Promise<(ServiceTitanEmployee & { team?: string })[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '200',
    active: 'true',
  });

  const endpoint = `/settings/v2/tenant/${config.tenantId}/technicians?${params.toString()}`;
  const response = await makeApiRequest(config, endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch technicians from Service Titan: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  let technicians = (data.data || []).map((tech: any) => ({
    id: tech.id?.toString() || '',
    name: tech.name || `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || 'Unknown',
    email: tech.email || '',
    phone: tech.phoneNumber || tech.phone || '',
    role: 'Technician',
    active: tech.active !== false,
    team: tech.team || '',
  }));

  // Filter by team if specified (case-insensitive partial match)
  if (teamFilter) {
    const filterLower = teamFilter.toLowerCase();
    technicians = technicians.filter((tech: any) =>
      tech.team?.toLowerCase().includes(filterLower)
    );
  }

  return technicians;
}

// Get all teams from technicians
export async function getTeams(config: ServiceTitanConfig): Promise<string[]> {
  const technicians = await syncTechniciansFromServiceTitan(config);
  const teams = [...new Set(technicians.map(t => t.team).filter(Boolean))];
  return teams.sort();
}

// Get business units from Service Titan
export async function getBusinessUnits(config: ServiceTitanConfig): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '200',
    active: 'true',
  });

  const endpoint = `/settings/v2/tenant/${config.tenantId}/business-units?${params.toString()}`;
  const response = await makeApiRequest(config, endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch business units: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return (data.data || []).map((bu: any) => ({
    id: bu.id?.toString() || '',
    name: bu.name || '',
  }));
}

// Sync Comfort Advisors specifically
export async function syncComfortAdvisorsFromServiceTitan(
  config: ServiceTitanConfig
): Promise<ServiceTitanEmployee[]> {
  // Try multiple role name variations
  const allEmployees = await syncEmployeesFromServiceTitan(config);

  // Filter for comfort advisor roles (case-insensitive, various naming conventions)
  const comfortAdvisors = allEmployees.filter(emp => {
    const role = emp.role.toLowerCase();
    return (
      role.includes('comfort advisor') ||
      role.includes('comfort-advisor') ||
      role.includes('comfortadvisor') ||
      role.includes('sales') ||
      role.includes('salesperson') ||
      role.includes('advisor')
    );
  });

  // If no advisors found with role filter, log available roles for debugging
  if (comfortAdvisors.length === 0) {
    console.log('No comfort advisors found. Available roles:',
      [...new Set(allEmployees.map(e => e.role))].join(', ')
    );
  }

  return comfortAdvisors;
}

export async function createLeadInServiceTitan(
  config: ServiceTitanConfig,
  lead: Lead
): Promise<string> {
  const endpoint = `/crm/v2/tenant/${config.tenantId}/leads`;

  const response = await makeApiRequest(config, endpoint, {
    method: 'POST',
    body: JSON.stringify({
      name: lead.clientName,
      phone: lead.phone,
      email: lead.email,
      address: {
        street: lead.address,
      },
      source: lead.leadType === 'TGL' ? 'Technician' : 'Marketing',
      value: lead.estimatedValue || 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create lead in Service Titan: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.id?.toString() || '';
}
