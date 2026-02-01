'use client';

import { useState, useRef, useEffect } from 'react';

export interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  dataDelay?: number; // Days of data delay (for display)
}

type PresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'mtd' | 'lastMonth' | 'qtd' | 'ytd' | 'custom';

interface PresetOption {
  key: PresetKey;
  label: string;
  getRange: () => DateRange;
}

export function DateRangePicker({ value, onChange, dataDelay = 0 }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>('mtd');
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presets: PresetOption[] = [
    {
      key: 'today',
      label: 'Today',
      getRange: () => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        return { start: dateStr, end: dateStr };
      },
    },
    {
      key: 'yesterday',
      label: 'Yesterday',
      getRange: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        return { start: dateStr, end: dateStr };
      },
    },
    {
      key: 'last7',
      label: 'Last 7 Days',
      getRange: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'last30',
      label: 'Last 30 Days',
      getRange: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'mtd',
      label: 'Month to Date',
      getRange: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'lastMonth',
      label: 'Last Month',
      getRange: () => {
        const end = new Date();
        end.setDate(0); // Last day of previous month
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'qtd',
      label: 'Quarter to Date',
      getRange: () => {
        const end = new Date();
        const quarter = Math.floor(end.getMonth() / 3);
        const start = new Date(end.getFullYear(), quarter * 3, 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'ytd',
      label: 'Year to Date',
      getRange: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), 0, 1);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      key: 'custom',
      label: 'Custom Range',
      getRange: () => ({ start: customStart, end: customEnd }),
    },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: PresetOption) => {
    setActivePreset(preset.key);
    if (preset.key !== 'custom') {
      const range = preset.getRange();
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleCustomApply = () => {
    onChange({ start: customStart, end: customEnd });
    setIsOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDisplayLabel = () => {
    const preset = presets.find(p => {
      if (p.key === 'custom') return false;
      const range = p.getRange();
      return range.start === value.start && range.end === value.end;
    });

    if (preset) {
      return preset.label;
    }

    return `${formatDisplayDate(value.start)} - ${formatDisplayDate(value.end)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--christmas-cream)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{getDisplayLabel()}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-lg shadow-xl z-50"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Presets */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="grid grid-cols-2 gap-1">
              {presets.filter(p => p.key !== 'custom').map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    activePreset === preset.key
                      ? 'bg-[#346643] text-white'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Range */}
          <div className="p-3">
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              Custom Range
            </div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Start</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full px-2 py-1.5 rounded text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full px-2 py-1.5 rounded text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--christmas-green)',
                color: 'var(--christmas-cream)',
              }}
            >
              Apply
            </button>
          </div>

          {/* Data delay notice */}
          {dataDelay > 0 && (
            <div className="px-3 pb-3">
              <div className="text-xs rounded-md p-2" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                Note: Data has a {dataDelay}-day delay from Google
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
