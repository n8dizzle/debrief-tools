'use client';

import { LayoutDashboard, Users, Kanban, TrendingUp, DollarSign, Lock, Settings, Plus, Cloud } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn } from '@/lib/utils';

export type TabType = 'dashboard' | 'enter-lead' | 'leads' | 'pipeline' | 'margin' | 'commission' | 'admin' | 'settings';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'enter-lead' as const, label: 'Enter Lead', icon: Plus },
  { id: 'leads' as const, label: 'Leads', icon: Users },
  { id: 'pipeline' as const, label: 'Pipeline', icon: Kanban },
  { id: 'margin' as const, label: 'Margin', icon: TrendingUp },
  { id: 'commission' as const, label: 'Commission', icon: DollarSign, adminOnly: true },
  { id: 'admin' as const, label: 'Admin', icon: Settings, adminOnly: true },
  { id: 'settings' as const, label: 'Settings', icon: Cloud, adminOnly: true },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { currentUser } = useDashboardStore();

  return (
    <nav className="glass-card p-2 flex gap-2 mx-6 mt-4 rounded-xl">
      {tabs.map((tab) => {
        const isLocked = tab.adminOnly && currentUser.role !== 'admin';
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !isLocked && onTabChange(tab.id)}
            disabled={isLocked}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-lg glow-sage'
                : isLocked
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {isLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
