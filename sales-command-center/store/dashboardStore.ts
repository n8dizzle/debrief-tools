import { create } from 'zustand';
import { Lead, ComfortAdvisor, User, KPIData, LeadType, LeadStatus, MarketedLeadInput, LeadAssignmentResult, ServiceTitanConfig, ServiceTitanSyncStatus, DateRange, DateRangePreset } from '@/types';

// Toast type for notifications
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

// Helper to calculate date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset, customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Helper to get start of week (Sunday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Helper to get start of quarter
  const getStartOfQuarter = (date: Date) => {
    const quarter = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), quarter * 3, 1);
  };

  switch (preset) {
    case 'today':
      return { preset, startDate: today, endDate: tomorrow };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { preset, startDate: yesterday, endDate: today };
    }

    case 'thisWeek': {
      const weekStart = getStartOfWeek(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return { preset, startDate: weekStart, endDate: weekEnd };
    }

    case 'weekToDate': {
      const weekStart = getStartOfWeek(today);
      return { preset, startDate: weekStart, endDate: tomorrow };
    }

    case 'last7': {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { preset, startDate: last7, endDate: tomorrow };
    }

    case 'last14': {
      const last14 = new Date(today);
      last14.setDate(last14.getDate() - 14);
      return { preset, startDate: last14, endDate: tomorrow };
    }

    case 'last30': {
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { preset, startDate: last30, endDate: tomorrow };
    }

    case 'mtd': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { preset, startDate: monthStart, endDate: tomorrow };
    }

    case 'lastMonth': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { preset, startDate: lastMonthStart, endDate: lastMonthEnd };
    }

    case 'last90': {
      const last90 = new Date(today);
      last90.setDate(last90.getDate() - 90);
      return { preset, startDate: last90, endDate: tomorrow };
    }

    case 'thisQuarter': {
      const quarterStart = getStartOfQuarter(today);
      const quarterEnd = new Date(quarterStart);
      quarterEnd.setMonth(quarterEnd.getMonth() + 3);
      return { preset, startDate: quarterStart, endDate: quarterEnd };
    }

    case 'lastQuarter': {
      const thisQuarterStart = getStartOfQuarter(today);
      const lastQuarterEnd = thisQuarterStart;
      const lastQuarterStart = new Date(thisQuarterStart);
      lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3);
      return { preset, startDate: lastQuarterStart, endDate: lastQuarterEnd };
    }

    case 'quarterToDate': {
      const quarterStart = getStartOfQuarter(today);
      return { preset, startDate: quarterStart, endDate: tomorrow };
    }

    case 'ytd': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { preset, startDate: yearStart, endDate: tomorrow };
    }

    case 'last365': {
      const last365 = new Date(today);
      last365.setDate(last365.getDate() - 365);
      return { preset, startDate: last365, endDate: tomorrow };
    }

    case 'lastYear': {
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(now.getFullYear(), 0, 1);
      return { preset, startDate: lastYearStart, endDate: lastYearEnd };
    }

    case 'custom':
      return {
        preset,
        startDate: customStart || today,
        endDate: customEnd || tomorrow,
      };

    default:
      return { preset: 'mtd', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: tomorrow };
  }
}

interface DashboardState {
  leads: Lead[];
  advisors: ComfortAdvisor[];
  currentUser: User;
  isLoading: boolean;
  isInitialized: boolean;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Data fetching from Supabase
  fetchLeads: () => Promise<void>;
  fetchAdvisors: () => Promise<void>;
  initializeData: () => Promise<void>;

  // Service Titan Integration
  serviceTitanConfig: ServiceTitanConfig | null;
  serviceTitanSyncStatus: ServiceTitanSyncStatus;
  lastSyncTime: Date | null;
  syncError: string | null;
  dateRange: DateRange;

  // Computed KPIs (will be calculated from leads/advisors)
  getKPIs: () => KPIData;

  // Actions
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (leadId: string, updates: Partial<Lead>) => void;
  assignLead: (leadId: string, leadType: LeadType) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;

  setAdvisors: (advisors: ComfortAdvisor[]) => void;
  addAdvisor: (advisor: ComfortAdvisor) => void;
  updateAdvisor: (advisorId: string, updates: Partial<ComfortAdvisor>) => void;

  setCurrentUser: (user: User) => void;

  // Marketed Lead Entry
  getNextMarketedAdvisor: () => ComfortAdvisor | null;
  addAndAssignLead: (leadData: MarketedLeadInput) => Promise<LeadAssignmentResult | null>;

  // Service Titan Actions
  setServiceTitanConfig: (config: ServiceTitanConfig | null) => void;
  clearServiceTitanConfig: () => void;
  setSyncStatus: (status: ServiceTitanSyncStatus) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncTime: (time: Date | null) => void;
  mergeServiceTitanLeads: (leads: Lead[]) => void;
  setDateRange: (preset: DateRangePreset, customStart?: Date, customEnd?: Date) => void;
  updateAdvisorSales: (advisorId: string, salesMTD: number, soldLeads: number) => void;

  // Initialize with sample data
  loadSampleData: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  leads: [],
  toasts: [],
  isLoading: false,
  isInitialized: false,

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-remove after duration
    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  fetchLeads: async () => {
    try {
      const response = await fetch('/api/leads');
      if (!response.ok) throw new Error('Failed to fetch leads');
      const { leads } = await response.json();
      set({ leads });
    } catch (error) {
      console.error('Error fetching leads:', error);
      get().addToast({ type: 'error', message: 'Failed to load leads' });
    }
  },

  fetchAdvisors: async () => {
    try {
      const response = await fetch('/api/advisors');
      if (!response.ok) throw new Error('Failed to fetch advisors');
      const { advisors } = await response.json();
      set({ advisors });
    } catch (error) {
      console.error('Error fetching advisors:', error);
      get().addToast({ type: 'error', message: 'Failed to load advisors' });
    }
  },

  initializeData: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });
    try {
      await Promise.all([get().fetchLeads(), get().fetchAdvisors()]);
      set({ isInitialized: true });
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  advisors: [
    {
      id: 'st-37214486',
      name: 'Luke Sage',
      email: 'lukesage@sky.com',
      phone: '(972) 800-7225',
      active: true,
      inQueue: true,
      tglQueuePosition: 1,
      marketedQueuePosition: 1,
      salesMTD: 0,
      averageSale: 0,
      closingRate: 0,
      salesOpps: 0,
      totalLeads: 0,
      soldLeads: 0,
    },
    {
      id: 'st-135560302',
      name: 'Brett Sutherland',
      email: 'brett@christmasair.com',
      phone: '(214) 701-5023',
      active: true,
      inQueue: true,
      tglQueuePosition: 2,
      marketedQueuePosition: 2,
      salesMTD: 0,
      averageSale: 0,
      closingRate: 0,
      salesOpps: 0,
      totalLeads: 0,
      soldLeads: 0,
    },
  ],
  currentUser: {
    id: '1',
    name: 'Admin User',
    email: 'admin@christmasair.com',
    role: 'admin',
  },

  // Service Titan state - pre-configured with credentials
  serviceTitanConfig: {
    clientId: 'cid.id52p1bf03y336mmge840en5l',
    clientSecret: 'cs1.8jckmgn897lx9qr4ruw9jg185ujh62zi1v9fkjnjnqtom0zdqw',
    appKey: 'ak1.fscoe5xled3zhbbzcnxjeimyx',
    tenantId: '1045848487',
    environment: 'production' as const,
  },
  serviceTitanSyncStatus: 'idle',
  lastSyncTime: null,
  syncError: null,
  dateRange: getDateRangeFromPreset('mtd'),

  getKPIs: () => {
    const { leads, advisors, dateRange } = get();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter leads within the selected date range
    const rangeLeads = leads.filter(l => {
      const createdDate = new Date(l.createdDate);
      return createdDate >= dateRange.startDate && createdDate < dateRange.endDate;
    });

    const soldLeads = rangeLeads.filter(l => l.status === 'Sold' || l.status === 'Install Scheduled' || l.status === 'Completed');
    const todayLeads = leads.filter(l => new Date(l.createdDate) >= startOfToday);
    const soldToday = todayLeads.filter(l => l.status === 'Sold' || l.status === 'Install Scheduled' || l.status === 'Completed');

    // Total sales from Service Titan synced advisor data (salesMTD is synced from ST estimates)
    const totalSalesFromAdvisors = advisors.reduce((sum, a) => sum + (a.salesMTD || 0), 0);

    // Fallback to leads data if no advisor sales synced
    const totalSalesFromLeads = soldLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
    const totalSales = totalSalesFromAdvisors > 0 ? totalSalesFromAdvisors : totalSalesFromLeads;

    // Gross margin from leads (Service Titan doesn't provide margin data directly)
    const grossMargin = soldLeads.reduce((sum, l) => sum + l.grossMarginDollar, 0);
    // If we have ST sales but no lead margin data, estimate at 40%
    const estimatedGrossMargin = totalSalesFromAdvisors > 0 && grossMargin === 0
      ? totalSales * 0.40
      : grossMargin;

    // Pipeline value: active leads within range that aren't sold/completed
    const pipelineValue = rangeLeads
      .filter(l => l.status !== 'Completed' && l.status !== 'Sold')
      .reduce((sum, l) => sum + l.estimatedValue, 0);

    // Active leads within date range
    const activeLeads = rangeLeads.filter(l => l.status !== 'Completed').length;

    // Total sold leads from advisors or from leads data
    const totalSoldFromAdvisors = advisors.reduce((sum, a) => sum + (a.soldLeads || 0), 0);
    const totalSoldFromLeads = soldLeads.length;
    const totalSold = totalSoldFromAdvisors > 0 ? totalSoldFromAdvisors : totalSoldFromLeads;

    // Calculate closing rate
    const totalRangeLeads = rangeLeads.length;
    const closingRate = totalRangeLeads > 0
      ? (totalSold / totalRangeLeads) * 100
      : (totalSold > 0 ? 100 : 0); // If we have sales but no lead tracking, show 100% or 0%

    return {
      totalSalesMTD: totalSales,
      grossMarginMTD: estimatedGrossMargin,
      grossMarginPercent: totalSales > 0 ? (estimatedGrossMargin / totalSales) * 100 : 0,
      pipelineValue,
      avgClosingRate: closingRate,
      activeLeads,
      newLeadsToday: todayLeads.filter(l => l.status === 'New Lead').length,
      soldToday: soldToday.length,
    };
  },

  setLeads: (leads) => set({ leads }),

  addLead: (lead) => {
    set((state) => ({ leads: [...state.leads, lead] }));
  },

  updateLead: (leadId, updates) => {
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, ...updates } : l
      ),
    }));
  },

  assignLead: (leadId, leadType) => {
    const state = get();
    const queueField = leadType === 'TGL' ? 'tglQueuePosition' : 'marketedQueuePosition';
    // Only consider advisors who are active AND in the queue
    const queueAdvisors = state.advisors.filter((a) => a.active && a.inQueue);
    const nextAdvisor = queueAdvisors.find((a) => a[queueField] === 1);

    if (!nextAdvisor) return;

    // Update the lead
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId
          ? { ...lead, assignedAdvisor: nextAdvisor.name, status: 'Assigned' as LeadStatus }
          : lead
      ),
    }));

    // Rotate the queue (only among in-queue advisors)
    const maxPosition = Math.max(...queueAdvisors.map((a) => a[queueField]));
    set((state) => ({
      advisors: state.advisors.map((advisor) => {
        if (!advisor.active || !advisor.inQueue) return advisor;
        return {
          ...advisor,
          [queueField]: advisor.id === nextAdvisor.id
            ? maxPosition
            : advisor[queueField] > 1
              ? advisor[queueField] - 1
              : advisor[queueField],
        };
      }),
    }));
  },

  updateLeadStatus: async (leadId, status) => {
    // Optimistic update
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead
      ),
    }));
    // Persist to Supabase
    try {
      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status }),
      });
      if (!response.ok) throw new Error('Failed to update status');
    } catch (error) {
      console.error('Failed to persist status update:', error);
      get().addToast({ type: 'error', message: 'Failed to save status change' });
    }
  },

  setAdvisors: (advisors) => set({ advisors }),

  addAdvisor: (advisor) => {
    set((state) => ({ advisors: [...state.advisors, advisor] }));
  },

  updateAdvisor: (advisorId, updates) => {
    set((state) => ({
      advisors: state.advisors.map((a) =>
        a.id === advisorId ? { ...a, ...updates } : a
      ),
    }));
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  getNextMarketedAdvisor: () => {
    const state = get();
    // Only consider advisors who are active AND in the queue
    const queueAdvisors = state.advisors.filter(a => a.active && a.inQueue);
    const nextAdvisor = queueAdvisors.find(a => a.marketedQueuePosition === 1);
    return nextAdvisor || null;
  },

  addAndAssignLead: async (leadData: MarketedLeadInput) => {
    const state = get();
    // Only consider advisors who are active AND in the queue
    const queueAdvisors = state.advisors.filter(a => a.active && a.inQueue);
    const nextAdvisor = queueAdvisors.find(a => a.marketedQueuePosition === 1);

    if (!nextAdvisor) return null;

    try {
      // Create lead in Supabase
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: leadData.customerName,
          leadType: 'Marketed',
          source: leadData.source,
          status: 'Assigned',
          assignedAdvisorId: nextAdvisor.id,
          phone: leadData.phone,
          address: leadData.address,
          notes: leadData.notes,
          unitAge: leadData.unitAge,
          systemType: leadData.systemType,
        }),
      });

      if (!response.ok) throw new Error('Failed to create lead');

      const { lead: persistedLead } = await response.json();
      const newLead: Lead = { ...persistedLead, assignedAdvisor: nextAdvisor.name };

      // Add to local state
      set((state) => ({ leads: [newLead, ...state.leads] }));

      // Compute new queue positions
      const maxPosition = Math.max(...queueAdvisors.map(a => a.marketedQueuePosition));
      const newPositions: Record<string, number> = {};
      for (const advisor of queueAdvisors) {
        newPositions[advisor.id] = advisor.id === nextAdvisor.id
          ? maxPosition
          : advisor.marketedQueuePosition > 1
            ? advisor.marketedQueuePosition - 1
            : advisor.marketedQueuePosition;
      }

      // Update local advisor state (optimistic)
      set((state) => ({
        advisors: state.advisors.map((advisor) => {
          if (!advisor.active || !advisor.inQueue) return advisor;
          return {
            ...advisor,
            marketedQueuePosition: newPositions[advisor.id] ?? advisor.marketedQueuePosition,
            totalLeads: advisor.id === nextAdvisor.id ? advisor.totalLeads + 1 : advisor.totalLeads,
          };
        }),
      }));

      // Persist queue rotation to Supabase
      await Promise.all(
        queueAdvisors.map((advisor) =>
          fetch('/api/advisors', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: advisor.id,
              marketedQueuePosition: newPositions[advisor.id],
            }),
          })
        )
      );

      return { lead: newLead, advisor: nextAdvisor };
    } catch (error) {
      console.error('Failed to create lead:', error);
      get().addToast({ type: 'error', message: 'Failed to create lead' });
      return null;
    }
  },

  // Service Titan Actions
  setServiceTitanConfig: (config) => set({ serviceTitanConfig: config }),

  clearServiceTitanConfig: () => set({
    serviceTitanConfig: null,
    serviceTitanSyncStatus: 'idle',
    lastSyncTime: null,
    syncError: null,
  }),

  setSyncStatus: (status) => set({ serviceTitanSyncStatus: status }),

  setSyncError: (error) => set({ syncError: error }),

  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  mergeServiceTitanLeads: (newLeads) => {
    set((state) => {
      // Merge leads: update existing by serviceTitanId, add new ones
      const existingMap = new Map(
        state.leads
          .filter((l) => l.serviceTitanId)
          .map((l) => [l.serviceTitanId, l])
      );

      const updatedLeads = [...state.leads];

      for (const lead of newLeads) {
        const existingLead = existingMap.get(lead.serviceTitanId);
        if (existingLead) {
          // Update existing lead
          const index = updatedLeads.findIndex((l) => l.id === existingLead.id);
          if (index !== -1) {
            updatedLeads[index] = {
              ...existingLead,
              ...lead,
              id: existingLead.id, // Keep original ID
              assignedAdvisor: existingLead.assignedAdvisor, // Keep assignment
              status: existingLead.status, // Keep local status
            };
          }
        } else {
          // Add new lead
          updatedLeads.push(lead);
        }
      }

      return { leads: updatedLeads };
    });
  },

  setDateRange: (preset, customStart, customEnd) => {
    set({ dateRange: getDateRangeFromPreset(preset, customStart, customEnd) });
  },

  updateAdvisorSales: (advisorId, salesMTD, soldLeads) => {
    set((state) => ({
      advisors: state.advisors.map((advisor) =>
        advisor.id === advisorId
          ? { ...advisor, salesMTD, soldLeads }
          : advisor
      ),
    }));
  },

  loadSampleData: () => {
    const sampleAdvisors: ComfortAdvisor[] = [
      {
        id: '1',
        name: 'Mike Johnson',
        email: 'mike@christmasair.com',
        phone: '(555) 123-4567',
        active: true,
        inQueue: true,
        tglQueuePosition: 1,
        marketedQueuePosition: 3,
        salesMTD: 127500,
        averageSale: 12750,
        closingRate: 42,
        salesOpps: 24,
        totalLeads: 24,
        soldLeads: 10,
      },
      {
        id: '2',
        name: 'Sarah Williams',
        email: 'sarah@christmasair.com',
        phone: '(555) 234-5678',
        active: true,
        inQueue: true,
        tglQueuePosition: 2,
        marketedQueuePosition: 1,
        salesMTD: 156000,
        averageSale: 10400,
        closingRate: 48,
        salesOpps: 31,
        totalLeads: 31,
        soldLeads: 15,
      },
      {
        id: '3',
        name: 'David Chen',
        email: 'david@christmasair.com',
        phone: '(555) 345-6789',
        active: true,
        inQueue: true,
        tglQueuePosition: 3,
        marketedQueuePosition: 2,
        salesMTD: 98000,
        averageSale: 12250,
        closingRate: 38,
        salesOpps: 21,
        totalLeads: 21,
        soldLeads: 8,
      },
      {
        id: '4',
        name: 'Jessica Taylor',
        email: 'jessica@christmasair.com',
        phone: '(555) 456-7890',
        active: true,
        inQueue: true,
        tglQueuePosition: 4,
        marketedQueuePosition: 4,
        salesMTD: 142000,
        averageSale: 11833,
        closingRate: 45,
        salesOpps: 27,
        totalLeads: 27,
        soldLeads: 12,
      },
    ];

    const sampleLeads: Lead[] = [
      {
        id: '1',
        clientName: 'Robert Anderson',
        leadType: 'TGL',
        source: 'Service Call',
        techName: 'Tom Brady',
        status: 'New Lead',
        estimatedValue: 12500,
        grossMarginPercent: 42,
        grossMarginDollar: 5250,
        createdDate: new Date(),
        phone: '(555) 123-4567',
        address: '1234 Oak Street, Houston, TX',
      },
      {
        id: '2',
        clientName: 'Emily Davis',
        leadType: 'Marketed',
        source: 'Google Ads',
        status: 'Assigned',
        assignedAdvisor: 'Sarah Williams',
        estimatedValue: 8900,
        grossMarginPercent: 38,
        grossMarginDollar: 3382,
        createdDate: new Date(Date.now() - 86400000),
        phone: '(555) 234-5678',
        address: '5678 Maple Ave, Houston, TX',
      },
      {
        id: '3',
        clientName: 'Michael Brown',
        leadType: 'TGL',
        source: 'Maintenance Visit',
        techName: 'Jake Smith',
        status: 'Quoted',
        assignedAdvisor: 'Mike Johnson',
        estimatedValue: 15600,
        grossMarginPercent: 44,
        grossMarginDollar: 6864,
        createdDate: new Date(Date.now() - 172800000),
        phone: '(555) 345-6789',
        address: '9012 Pine Road, Houston, TX',
      },
      {
        id: '4',
        clientName: 'Jennifer Wilson',
        leadType: 'Marketed',
        source: 'Facebook',
        status: 'Sold',
        assignedAdvisor: 'David Chen',
        estimatedValue: 22000,
        grossMarginPercent: 46,
        grossMarginDollar: 10120,
        createdDate: new Date(Date.now() - 259200000),
        phone: '(555) 456-7890',
        address: '3456 Cedar Lane, Houston, TX',
      },
      {
        id: '5',
        clientName: 'Christopher Lee',
        leadType: 'TGL',
        source: 'Repair Call',
        techName: 'Mark Davis',
        status: 'Install Scheduled',
        assignedAdvisor: 'Jessica Taylor',
        estimatedValue: 18500,
        grossMarginPercent: 41,
        grossMarginDollar: 7585,
        createdDate: new Date(Date.now() - 345600000),
        phone: '(555) 567-8901',
        address: '7890 Elm Street, Houston, TX',
      },
      {
        id: '6',
        clientName: 'Amanda Martinez',
        leadType: 'Marketed',
        source: 'Referral',
        status: 'Completed',
        assignedAdvisor: 'Sarah Williams',
        estimatedValue: 31000,
        grossMarginPercent: 48,
        grossMarginDollar: 14880,
        createdDate: new Date(Date.now() - 432000000),
        phone: '(555) 678-9012',
        address: '2345 Birch Ave, Houston, TX',
      },
      {
        id: '7',
        clientName: 'James Thompson',
        leadType: 'TGL',
        source: 'Service Call',
        techName: 'Tom Brady',
        status: 'New Lead',
        estimatedValue: 9800,
        grossMarginPercent: 39,
        grossMarginDollar: 3822,
        createdDate: new Date(),
        phone: '(555) 789-0123',
        address: '6789 Walnut Drive, Houston, TX',
      },
      {
        id: '8',
        clientName: 'Patricia Garcia',
        leadType: 'Marketed',
        source: 'Google Ads',
        status: 'New Lead',
        estimatedValue: 14200,
        grossMarginPercent: 43,
        grossMarginDollar: 6106,
        createdDate: new Date(),
        phone: '(555) 890-1234',
        address: '1357 Spruce Court, Houston, TX',
      },
    ];

    set({ advisors: sampleAdvisors, leads: sampleLeads });
  },
}));
