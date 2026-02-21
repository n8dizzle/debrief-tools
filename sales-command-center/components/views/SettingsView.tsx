'use client';

import { useState, useEffect } from 'react';
import { Settings, CheckCircle, XCircle, RefreshCw, Cloud, Key, Building, Server, Calendar, Lock } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { ServiceTitanConfig, DateRangePreset } from '@/types';

const DATE_PRESETS: { value: DateRangePreset; label: string; group?: string }[] = [
  { value: 'today', label: 'Today', group: 'Days' },
  { value: 'yesterday', label: 'Yesterday', group: 'Days' },
  { value: 'thisWeek', label: 'This Week', group: 'Weeks' },
  { value: 'weekToDate', label: 'Week to Date', group: 'Weeks' },
  { value: 'last7', label: 'Last 7 Days', group: 'Weeks' },
  { value: 'last14', label: 'Last 14 Days', group: 'Weeks' },
  { value: 'last30', label: 'Last 30 Days', group: 'Months' },
  { value: 'mtd', label: 'Month to Date', group: 'Months' },
  { value: 'lastMonth', label: 'Last Month', group: 'Months' },
  { value: 'last90', label: 'Last 90 Days', group: 'Quarters' },
  { value: 'thisQuarter', label: 'This Quarter', group: 'Quarters' },
  { value: 'lastQuarter', label: 'Last Quarter', group: 'Quarters' },
  { value: 'quarterToDate', label: 'Quarter to Date', group: 'Quarters' },
  { value: 'ytd', label: 'Year to Date', group: 'Years' },
  { value: 'last365', label: 'Last 365 Days', group: 'Years' },
  { value: 'lastYear', label: 'Last Year', group: 'Years' },
  { value: 'custom', label: 'Custom Range', group: 'Custom' },
];

export function SettingsView() {
  const {
    serviceTitanConfig,
    serviceTitanSyncStatus,
    lastSyncTime,
    syncError,
    dateRange,
    advisors,
    setServiceTitanConfig,
    clearServiceTitanConfig,
    setSyncStatus,
    setSyncError,
    setLastSyncTime,
    mergeServiceTitanLeads,
    setDateRange,
    updateAdvisorSales,
  } = useDashboardStore();

  const [formData, setFormData] = useState<ServiceTitanConfig>({
    clientId: serviceTitanConfig?.clientId || '',
    clientSecret: serviceTitanConfig?.clientSecret || '',
    appKey: serviceTitanConfig?.appKey || '',
    tenantId: serviceTitanConfig?.tenantId || '',
    environment: serviceTitanConfig?.environment || 'production',
  });

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfiguredViaEnv, setIsConfiguredViaEnv] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(15); // minutes
  const [nextRefreshTime, setNextRefreshTime] = useState<Date | null>(null);

  // Check if configured via environment on mount
  useEffect(() => {
    async function checkEnvConfig() {
      try {
        const response = await fetch('/api/servicetitan');
        const data = await response.json();
        setIsConfiguredViaEnv(data.configured === true);
      } catch (error) {
        console.error('Failed to check Service Titan config:', error);
      }
    }
    checkEnvConfig();
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !isConfiguredViaEnv) return;

    const intervalMs = autoRefreshInterval * 60 * 1000;

    const runSync = async () => {
      console.log('Auto-refresh: syncing data...');
      setSyncStatus('syncing');

      try {
        // Sync leads
        const leadsResponse = await fetch('/api/servicetitan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString(),
          }),
        });
        const leadsData = await leadsResponse.json();
        if (leadsData.success && leadsData.leads) {
          mergeServiceTitanLeads(leadsData.leads);
        }

        // Sync sales
        const salesResponse = await fetch('/api/servicetitan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'syncSales',
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString(),
          }),
        });
        const salesData = await salesResponse.json();
        if (salesData.success && salesData.salesData) {
          for (const advisorData of salesData.salesData) {
            updateAdvisorSales(
              advisorData.advisorId,
              advisorData.totalSales,
              advisorData.sales.length
            );
          }
        }

        setLastSyncTime(new Date());
        setSyncStatus('success');
        setNextRefreshTime(new Date(Date.now() + intervalMs));
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        setSyncStatus('error');
      }
    };

    // Set next refresh time
    setNextRefreshTime(new Date(Date.now() + intervalMs));

    const interval = setInterval(runSync, intervalMs);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshInterval, isConfiguredViaEnv, dateRange, mergeServiceTitanLeads, updateAdvisorSales, setSyncStatus, setLastSyncTime]);

  const [customStartDate, setCustomStartDate] = useState(dateRange.startDate.toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(dateRange.endDate.toISOString().split('T')[0]);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [isSyncingSales, setIsSyncingSales] = useState(false);
  const [salesSyncResult, setSalesSyncResult] = useState<string | null>(null);
  const [isSyncingAdvisors, setIsSyncingAdvisors] = useState(false);
  const [advisorSyncResult, setAdvisorSyncResult] = useState<string | null>(null);
  const [isLinkingAdvisors, setIsLinkingAdvisors] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceTitanConfig(formData);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          config: isConfiguredViaEnv ? undefined : formData
        }),
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || 'Unknown result',
      });

      if (data.success && !isConfiguredViaEnv) {
        setServiceTitanConfig(formData);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncLeads = async () => {
    if (!serviceTitanConfig && !isConfiguredViaEnv) {
      setSyncError('Please save and test your configuration first');
      return;
    }

    setSyncStatus('syncing');
    setSyncError(null);
    setLastSyncCount(null);

    try {
      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success && data.leads) {
        mergeServiceTitanLeads(data.leads);
        setLastSyncTime(new Date());
        setLastSyncCount(data.count);
        setSyncStatus('success');
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error: any) {
      setSyncError(error.message || 'Failed to sync leads');
      setSyncStatus('error');
    }
  };

  const handleDatePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setDateRange('custom', new Date(customStartDate), new Date(customEndDate));
    } else {
      setDateRange(preset);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    if (dateRange.preset === 'custom') {
      setDateRange('custom', new Date(start), new Date(end));
    }
  };

  const handleSyncSales = async () => {
    if (!serviceTitanConfig && !isConfiguredViaEnv) {
      setSyncError('Please save and test your configuration first');
      return;
    }

    setIsSyncingSales(true);
    setSalesSyncResult(null);

    try {
      const advisorIds = advisors.map(a => a.id);

      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncSales',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
          advisorIds,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success && data.salesData) {
        let totalSales = 0;
        let totalDeals = 0;

        for (const advisorData of data.salesData) {
          totalSales += advisorData.totalSales;
          totalDeals += advisorData.sales.length;
        }

        // Refresh advisors from database to get persisted sales data
        await useDashboardStore.getState().fetchAdvisors();

        setSalesSyncResult(`Synced ${totalDeals} sales totaling $${totalSales.toLocaleString()}`);
      } else {
        throw new Error(data.error || 'Sales sync failed');
      }
    } catch (error: any) {
      setSalesSyncResult(`Error: ${error.message}`);
    } finally {
      setIsSyncingSales(false);
    }
  };

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    if (!serviceTitanConfig && !isConfiguredViaEnv) {
      setSyncError('Please save and test your configuration first');
      return;
    }

    setIsSyncingAll(true);
    setSyncStatus('syncing');
    setSyncError(null);
    setSalesSyncResult(null);

    try {
      // Sync leads
      const leadsResponse = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        }),
      });

      const leadsData = await leadsResponse.json();
      let leadsCount = 0;
      if (leadsData.success && leadsData.leads) {
        mergeServiceTitanLeads(leadsData.leads);
        leadsCount = leadsData.count;
      }

      // Sync sales
      const salesResponse = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncSales',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        }),
      });

      const salesData = await salesResponse.json();
      let totalSales = 0;
      let totalDeals = 0;
      if (salesData.success && salesData.salesData) {
        for (const advisorData of salesData.salesData) {
          totalSales += advisorData.totalSales;
          totalDeals += advisorData.sales.length;
        }
      }

      // Refresh advisors from database to get persisted sales data
      await useDashboardStore.getState().fetchAdvisors();

      setLastSyncTime(new Date());
      setLastSyncCount(leadsCount);
      setSalesSyncResult(`${totalDeals} sales totaling $${totalSales.toLocaleString()}`);
      setSyncStatus('success');

      if (autoRefreshEnabled) {
        setNextRefreshTime(new Date(Date.now() + autoRefreshInterval * 60 * 1000));
      }
    } catch (error: any) {
      setSyncError(error.message || 'Sync failed');
      setSyncStatus('error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleLinkAdvisors = async () => {
    if (!serviceTitanConfig && !isConfiguredViaEnv) {
      setSyncError('Please save and test your configuration first');
      return;
    }

    setIsLinkingAdvisors(true);
    setLinkResult(null);

    try {
      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'linkAdvisors',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
        }),
      });

      const data = await response.json();

      if (data.success) {
        let msg = data.message;
        if (data.unlinked && data.unlinked.length > 0) {
          msg += ` Unlinked: ${data.unlinked.map((u: any) => u.advisor).join(', ')}`;
        }
        setLinkResult(msg);
        // Refresh advisors
        useDashboardStore.getState().fetchAdvisors();
      } else {
        throw new Error(data.error || 'Failed to link advisors');
      }
    } catch (error: any) {
      setLinkResult(`Error: ${error.message}`);
    } finally {
      setIsLinkingAdvisors(false);
    }
  };

  const handleSyncAdvisors = async () => {
    if (!serviceTitanConfig && !isConfiguredViaEnv) {
      setSyncError('Please save and test your configuration first');
      return;
    }

    setIsSyncingAdvisors(true);
    setAdvisorSyncResult(null);

    try {
      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncAdvisors',
          config: isConfiguredViaEnv ? undefined : serviceTitanConfig,
          team: 'Comfort Advisors', // Filter to only Comfort Advisors team
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAdvisorSyncResult(data.message || `Synced ${data.count} employees from Service Titan`);
        // Refresh advisors in the store
        useDashboardStore.getState().fetchAdvisors();
      } else {
        throw new Error(data.error || 'Advisor sync failed');
      }
    } catch (error: any) {
      setAdvisorSyncResult(`Error: ${error.message}`);
    } finally {
      setIsSyncingAdvisors(false);
    }
  };

  const handleClearConfig = () => {
    clearServiceTitanConfig();
    setFormData({
      clientId: '',
      clientSecret: '',
      appKey: '',
      tenantId: '',
      environment: 'integration',
    });
    setTestResult(null);
  };

  const isConfigured = serviceTitanConfig !== null || isConfiguredViaEnv;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Configure Service Titan integration and sync settings</p>
      </div>

      {/* Connection Status Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Cloud className="w-5 h-5 text-sage" />
          <h3 className="text-lg font-semibold text-foreground">Service Titan Connection</h3>
          {(isConfigured || isConfiguredViaEnv) && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-sales/20 text-green-sales flex items-center gap-1">
              {isConfiguredViaEnv && <Lock className="w-3 h-3" />}
              {isConfiguredViaEnv ? 'Configured via Environment' : 'Configured'}
            </span>
          )}
        </div>

        {/* Show env config notice */}
        {isConfiguredViaEnv && (
          <div className="mb-4 p-4 rounded-lg bg-sage/10 border border-sage/30">
            <div className="flex items-center gap-2 text-sage">
              <Lock className="w-4 h-4" />
              <span className="font-medium">Credentials configured via environment variables</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Service Titan credentials are securely stored in environment variables (ST_CLIENT_ID, ST_CLIENT_SECRET, ST_APP_KEY, ST_TENANT_ID).
              The form below is disabled.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-4">
          {/* Environment Selection */}
          <div className={isConfiguredViaEnv ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-sm text-muted-foreground mb-1">Environment</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="integration"
                  checked={formData.environment === 'integration'}
                  onChange={(e) => setFormData({ ...formData, environment: 'integration' })}
                  className="w-4 h-4 text-sage focus:ring-sage"
                  disabled={isConfiguredViaEnv}
                />
                <span className="text-foreground">Integration (Sandbox)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="production"
                  checked={formData.environment === 'production'}
                  onChange={(e) => setFormData({ ...formData, environment: 'production' })}
                  className="w-4 h-4 text-sage focus:ring-sage"
                  disabled={isConfiguredViaEnv}
                />
                <span className="text-foreground">Production</span>
              </label>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isConfiguredViaEnv ? 'opacity-50' : ''}`}>
            {/* Client ID */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Client ID
                </span>
              </label>
              <input
                type="text"
                required={!isConfiguredViaEnv}
                disabled={isConfiguredViaEnv}
                value={isConfiguredViaEnv ? '••••••••••••' : formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="cid.xxxxx..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Client Secret
                </span>
              </label>
              <input
                type="password"
                required
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="cs1.xxxxx..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* App Key */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  App Key (ST-App-Key)
                </span>
              </label>
              <input
                type="text"
                required
                value={formData.appKey}
                onChange={(e) => setFormData({ ...formData, appKey: e.target.value })}
                placeholder="ak1.xxxxx..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Tenant ID */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  Tenant ID
                </span>
              </label>
              <input
                type="text"
                required
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                placeholder="12345678"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 ${
                testResult.success
                  ? 'bg-green-sales/10 border border-green-sales/30'
                  : 'bg-destructive/10 border border-destructive/30'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-sales" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <span className={testResult.success ? 'text-green-sales' : 'text-destructive'}>
                {testResult.message}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.clientId || !formData.clientSecret || !formData.appKey || !formData.tenantId}
              className="px-4 py-2 rounded-lg bg-sage hover:bg-sage/90 text-white font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Test Connection
                </>
              )}
            </button>

            {isConfigured && (
              <button
                type="button"
                onClick={handleClearConfig}
                className="px-4 py-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 font-medium text-sm transition-colors"
              >
                Clear Configuration
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sync Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="w-5 h-5 text-sage" />
          <h3 className="text-lg font-semibold text-foreground">Lead Sync</h3>
        </div>

        <div className="space-y-4">
          {/* Date Range Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Date Range
                </span>
              </label>
              <select
                value={dateRange.preset}
                onChange={(e) => handleDatePresetChange(e.target.value as DateRangePreset)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <optgroup label="Days">
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                </optgroup>
                <optgroup label="Weeks">
                  <option value="thisWeek">This Week</option>
                  <option value="weekToDate">Week to Date</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last14">Last 14 Days</option>
                </optgroup>
                <optgroup label="Months">
                  <option value="last30">Last 30 Days</option>
                  <option value="mtd">Month to Date</option>
                  <option value="lastMonth">Last Month</option>
                </optgroup>
                <optgroup label="Quarters">
                  <option value="last90">Last 90 Days</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="quarterToDate">Quarter to Date</option>
                </optgroup>
                <optgroup label="Years">
                  <option value="ytd">Year to Date</option>
                  <option value="last365">Last 365 Days</option>
                  <option value="lastYear">Last Year</option>
                </optgroup>
                <optgroup label="Custom">
                  <option value="custom">Custom Range</option>
                </optgroup>
              </select>

              {/* Show selected range */}
              <p className="text-xs text-muted-foreground mt-2">
                {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
              </p>
            </div>

            {/* Auto-Refresh Settings */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Auto-Refresh
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  disabled={!isConfiguredViaEnv}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    autoRefreshEnabled ? 'bg-green-sales' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefreshEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefreshEnabled}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
                >
                  <option value={5}>Every 5 min</option>
                  <option value={10}>Every 10 min</option>
                  <option value={15}>Every 15 min</option>
                  <option value={30}>Every 30 min</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>
              {autoRefreshEnabled && nextRefreshTime && (
                <p className="text-xs text-muted-foreground mt-2">
                  Next refresh: {nextRefreshTime.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Custom Date Inputs */}
          {dateRange.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => handleCustomDateChange(e.target.value, customEndDate)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => handleCustomDateChange(customStartDate, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
          )}

          {/* Sync Status */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Sync Status</p>
              <div className="flex items-center gap-2">
                {serviceTitanSyncStatus === 'idle' && (
                  <span className="text-foreground">Not synced yet</span>
                )}
                {serviceTitanSyncStatus === 'syncing' && (
                  <span className="flex items-center gap-2 text-sage">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </span>
                )}
                {serviceTitanSyncStatus === 'success' && (
                  <span className="flex items-center gap-2 text-green-sales">
                    <CheckCircle className="w-4 h-4" />
                    Sync successful {lastSyncCount !== null && `(${lastSyncCount} leads)`}
                  </span>
                )}
                {serviceTitanSyncStatus === 'error' && (
                  <span className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-4 h-4" />
                    Sync failed
                  </span>
                )}
              </div>
            </div>

            {lastSyncTime && (
              <div>
                <p className="text-sm text-muted-foreground">Last Sync</p>
                <p className="text-foreground">{lastSyncTime.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Sync Error */}
          {syncError && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-destructive text-sm">{syncError}</p>
            </div>
          )}

          {/* Sync Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSyncAll}
              disabled={!isConfigured || isSyncingAll}
              className="px-6 py-3 rounded-lg bg-forest hover:bg-forest/90 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              {isSyncingAll ? 'Syncing All...' : 'Sync All Data'}
            </button>

            <button
              onClick={handleSyncLeads}
              disabled={!isConfigured || serviceTitanSyncStatus === 'syncing' || isSyncingAll}
              className="px-6 py-3 rounded-lg bg-green-sales hover:bg-green-sales/90 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${serviceTitanSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {serviceTitanSyncStatus === 'syncing' ? 'Syncing...' : 'Sync Leads'}
            </button>

            <button
              onClick={handleSyncSales}
              disabled={!isConfigured || isSyncingSales || isSyncingAll}
              className="px-6 py-3 rounded-lg bg-sage hover:bg-sage/90 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSales ? 'animate-spin' : ''}`} />
              {isSyncingSales ? 'Syncing...' : 'Sync Sales'}
            </button>

            <button
              onClick={handleSyncAdvisors}
              disabled={!isConfigured || isSyncingAdvisors}
              className="px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAdvisors ? 'animate-spin' : ''}`} />
              {isSyncingAdvisors ? 'Syncing...' : 'Sync Advisors'}
            </button>

            <button
              onClick={handleLinkAdvisors}
              disabled={!isConfigured || isLinkingAdvisors}
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLinkingAdvisors ? 'animate-spin' : ''}`} />
              {isLinkingAdvisors ? 'Linking...' : 'Link Advisors'}
            </button>
          </div>

          {/* Sales Sync Result */}
          {salesSyncResult && (
            <div className={`p-3 rounded-lg text-sm ${
              salesSyncResult.startsWith('Error')
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-sales/10 text-green-sales'
            }`}>
              {salesSyncResult}
            </div>
          )}

          {/* Advisor Sync Result */}
          {advisorSyncResult && (
            <div className={`p-3 rounded-lg text-sm ${
              advisorSyncResult.startsWith('Error')
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-sales/10 text-green-sales'
            }`}>
              {advisorSyncResult}
            </div>
          )}

          {/* Link Advisors Result */}
          {linkResult && (
            <div className={`p-3 rounded-lg text-sm ${
              linkResult.startsWith('Error')
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-600'
            }`}>
              {linkResult}
            </div>
          )}

          {!isConfigured && (
            <p className="text-sm text-muted-foreground">
              Configure and test your Service Titan connection above before syncing.
            </p>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-sage" />
          <h3 className="text-lg font-semibold text-foreground">Service Titan Setup Help</h3>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>To connect your Service Titan account:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Log in to your Service Titan developer portal</li>
            <li>Create or select an app integration</li>
            <li>Copy your <strong className="text-foreground">Client ID</strong> and <strong className="text-foreground">Client Secret</strong> from the OAuth2 credentials</li>
            <li>Copy your <strong className="text-foreground">App Key</strong> from the app settings</li>
            <li>Find your <strong className="text-foreground">Tenant ID</strong> in your Service Titan account settings</li>
            <li>Select the appropriate environment (Integration for testing, Production for live data)</li>
          </ol>
          <p className="mt-4">
            <strong className="text-foreground">Note:</strong> Tokens expire after 15 minutes and are automatically refreshed.
          </p>
        </div>
      </div>
    </div>
  );
}
