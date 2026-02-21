'use client';

import { useState, useRef, useEffect } from 'react';
import { Snowflake, Bell, Settings, User, Calendar, ChevronDown } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { DateRangePreset } from '@/types';
import { LeadPolling } from '@/components/LeadPolling';

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' },
];

interface HeaderProps {
  onSettingsClick?: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  const { currentUser, leads, dateRange, setDateRange } = useDashboardStore();
  const newLeadsCount = leads.filter(l => l.status === 'New Lead').length;

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(dateRange.startDate.toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(dateRange.endDate.toISOString().split('T')[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setDateRange('custom', new Date(customStartDate), new Date(customEndDate));
    } else {
      setDateRange(preset);
      setIsDatePickerOpen(false);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom', new Date(start), new Date(end));
  };

  const currentPresetLabel = DATE_PRESETS.find(p => p.value === dateRange.preset)?.label || 'Select Range';

  return (
    <header className="glass-card border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-forest flex items-center justify-center glow-forest">
          <Snowflake className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Christmas Air & Plumbing Sales Command Center</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date Range Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors"
          >
            <Calendar className="w-4 h-4 text-sage" />
            <span className="text-sm font-medium text-foreground">{currentPresetLabel}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 w-72 glass-card p-4 shadow-xl z-50">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Select Date Range</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {DATE_PRESETS.filter(p => p.value !== 'custom').map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetSelect(preset.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      dateRange.preset === preset.value
                        ? 'bg-sage text-white'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Custom Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Start</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => handleCustomDateChange(e.target.value, customEndDate)}
                      className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-sage text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">End</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => handleCustomDateChange(customStartDate, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-sage text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border mt-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lead Polling Status */}
        <div className="border-l border-border pl-4">
          <LeadPolling />
        </div>

        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
            <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-sage/10 text-sage border border-sage/30">
              {currentUser.role}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sage to-sage-glow flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}
