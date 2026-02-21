'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { TabNavigation, TabType } from '@/components/layout/TabNavigation';
import { DashboardView } from '@/components/views/DashboardView';
import { MarketedLeadEntryView } from '@/components/views/MarketedLeadEntryView';
import { LeadsView } from '@/components/views/LeadsView';
import { PipelineView } from '@/components/views/PipelineView';
import { MarginView } from '@/components/views/MarginView';
import { CommissionView } from '@/components/views/CommissionView';
import { AdminView } from '@/components/views/AdminView';
import { SettingsView } from '@/components/views/SettingsView';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDashboardStore } from '@/store/dashboardStore';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { isLoading, isInitialized, initializeData } = useDashboardStore();

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'enter-lead':
        return <MarketedLeadEntryView />;
      case 'leads':
        return <LeadsView />;
      case 'pipeline':
        return <PipelineView />;
      case 'margin':
        return <MarginView />;
      case 'commission':
        return <CommissionView />;
      case 'admin':
        return <AdminView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen">
      {isLoading && !isInitialized && <LoadingOverlay message="Loading dashboard..." />}
      <Header onSettingsClick={() => setActiveTab('settings')} />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="p-6">
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </main>
      <ToastProvider />
    </div>
  );
}
