'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

export interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, presetKey?: string) => void;
  dataDelay?: number;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Preset {
  key: string;
  label: string;
  getRange: (dataEnd: Date) => DateRange;
}

const PRESETS: Preset[] = [
  {
    key: 'today',
    label: 'Today',
    getRange: (dataEnd) => ({ start: formatDateInput(dataEnd), end: formatDateInput(dataEnd) }),
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    getRange: (dataEnd) => {
      const d = new Date(dataEnd);
      d.setDate(d.getDate() - 1);
      return { start: formatDateInput(d), end: formatDateInput(d) };
    },
  },
  {
    key: 'this_week',
    label: 'This Week',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - diff);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'wtd',
    label: 'Week to Date',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - diff);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: '7d',
    label: 'Last 7 Days',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      start.setDate(start.getDate() - 6);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: '14d',
    label: 'Last 14 Days',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      start.setDate(start.getDate() - 13);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: '30d',
    label: 'Last 30 Days',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      start.setDate(start.getDate() - 29);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'mtd',
    label: 'Month to Date',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd.getFullYear(), dataEnd.getMonth(), 1);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'last_month',
    label: 'Last Month',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd.getFullYear(), dataEnd.getMonth() - 1, 1);
      const end = new Date(dataEnd.getFullYear(), dataEnd.getMonth(), 0);
      return { start: formatDateInput(start), end: formatDateInput(end) };
    },
  },
  {
    key: '90d',
    label: 'Last 90 Days',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      start.setDate(start.getDate() - 89);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'this_quarter',
    label: 'This Quarter',
    getRange: (dataEnd) => {
      const quarter = Math.floor(dataEnd.getMonth() / 3);
      const start = new Date(dataEnd.getFullYear(), quarter * 3, 1);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'last_quarter',
    label: 'Last Quarter',
    getRange: (dataEnd) => {
      const quarter = Math.floor(dataEnd.getMonth() / 3);
      const start = new Date(dataEnd.getFullYear(), (quarter - 1) * 3, 1);
      const end = new Date(dataEnd.getFullYear(), quarter * 3, 0);
      return { start: formatDateInput(start), end: formatDateInput(end) };
    },
  },
  {
    key: 'qtd',
    label: 'Quarter to Date',
    getRange: (dataEnd) => {
      const quarter = Math.floor(dataEnd.getMonth() / 3);
      const start = new Date(dataEnd.getFullYear(), quarter * 3, 1);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'ytd',
    label: 'Year to Date',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd.getFullYear(), 0, 1);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: '365d',
    label: 'Last 365 Days',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd);
      start.setDate(start.getDate() - 364);
      return { start: formatDateInput(start), end: formatDateInput(dataEnd) };
    },
  },
  {
    key: 'last_year',
    label: 'Last Year',
    getRange: (dataEnd) => {
      const start = new Date(dataEnd.getFullYear() - 1, 0, 1);
      const end = new Date(dataEnd.getFullYear() - 1, 11, 31);
      return { start: formatDateInput(start), end: formatDateInput(end) };
    },
  },
];

// Mini Calendar Component
function MiniCalendar({
  month,
  year,
  selectedStart,
  selectedEnd,
  onDateClick,
  onMonthChange,
}: {
  month: number;
  year: number;
  selectedStart: string;
  selectedEnd: string;
  onDateClick: (date: string) => void;
  onMonthChange: (delta: number) => void;
}) {
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const isSelected = (day: number) => {
    const dateStr = formatDateInput(new Date(year, month, day));
    return dateStr === selectedStart || dateStr === selectedEnd;
  };

  const isInRange = (day: number) => {
    const dateStr = formatDateInput(new Date(year, month, day));
    return dateStr > selectedStart && dateStr < selectedEnd;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  return (
    <div className="w-[280px]">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => onMonthChange(-1)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="#8a9a8a" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium" style={{ color: '#e5e0d6' }}>{monthName}</span>
        <button
          onClick={() => onMonthChange(1)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="#8a9a8a" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: '#6a7a6a' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => (
          <div key={idx} className="aspect-square flex items-center justify-center">
            {day && (
              <button
                onClick={() => onDateClick(formatDateInput(new Date(year, month, day)))}
                className={`w-8 h-8 rounded-full text-sm transition-all ${
                  isSelected(day)
                    ? 'bg-[#5d8a66] text-white font-medium'
                    : isInRange(day)
                    ? 'bg-[#5d8a66]/20 text-[#a5c0a5]'
                    : isToday(day)
                    ? 'ring-1 ring-[#5d8a66] text-[#c5d0c5]'
                    : 'text-[#c5d0c5] hover:bg-white/10'
                }`}
              >
                {day}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
  dataDelay = 3,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('mtd');
  const [tempStart, setTempStart] = useState(value.start);
  const [tempEnd, setTempEnd] = useState(value.end);
  const [selectingStart, setSelectingStart] = useState(true);
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = new Date(value.start + 'T00:00:00');
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dataEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dataDelay);
    return d;
  }, [dataDelay]);

  // Right calendar is always one month ahead
  const rightMonth = useMemo(() => {
    let m = leftMonth.month + 1;
    let y = leftMonth.year;
    if (m > 11) { m = 0; y++; }
    return { month: m, year: y };
  }, [leftMonth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setTempStart(value.start);
    setTempEnd(value.end);
  }, [value]);

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getRange(dataEnd);
    setSelectedPreset(preset.key);
    setTempStart(range.start);
    setTempEnd(range.end);
    onChange(range, preset.key);
    setIsOpen(false);
  };

  const handleDateClick = (dateStr: string) => {
    if (selectingStart) {
      setTempStart(dateStr);
      setTempEnd(dateStr);
      setSelectingStart(false);
      setSelectedPreset('custom');
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr);
        setTempEnd(tempStart);
      } else {
        setTempEnd(dateStr);
      }
      setSelectingStart(true);
    }
  };

  const handleApply = () => {
    onChange({ start: tempStart, end: tempEnd }, selectedPreset);
    setIsOpen(false);
  };

  const handleMonthChange = (delta: number) => {
    setLeftMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { month: m, year: y };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setLeftMonth({ month: today.getMonth(), year: today.getFullYear() });
  };

  const daysInRange = Math.ceil(
    (new Date(value.end).getTime() - new Date(value.start).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const getDisplayLabel = () => {
    const preset = PRESETS.find(p => p.key === selectedPreset);
    if (preset && selectedPreset !== 'custom') {
      return preset.label;
    }
    return 'Custom';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg transition-all hover:brightness-110 group"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="var(--christmas-green-light)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>

        <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
          {getDisplayLabel()}
        </span>

        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
          {daysInRange}d
        </span>

        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="var(--text-muted)"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{
            backgroundColor: '#151a15',
            border: '1px solid #2a352a',
          }}
        >
          <div className="flex">
            {/* Presets Column */}
            <div
              className="w-44 py-2 max-h-[420px] overflow-y-auto"
              style={{ borderRight: '1px solid #2a352a' }}
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetClick(preset)}
                  className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/5 flex items-center justify-between"
                  style={{
                    color: selectedPreset === preset.key ? '#7ab886' : '#a5b0a5',
                    backgroundColor: selectedPreset === preset.key ? 'rgba(93, 138, 102, 0.12)' : 'transparent',
                  }}
                >
                  <span>{preset.label}</span>
                  {selectedPreset === preset.key && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Calendar Section */}
            <div className="p-4">
              {/* Date Inputs Row */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#6a7a6a" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="date"
                    value={tempStart}
                    onChange={(e) => { setTempStart(e.target.value); setSelectedPreset('custom'); }}
                    className="px-2 py-1.5 text-sm rounded-md w-32 focus:outline-none focus:ring-1 focus:ring-[#5d8a66]"
                    style={{
                      backgroundColor: '#252a25',
                      border: '1px solid #3a453a',
                      color: '#c5d0c5',
                    }}
                  />
                </div>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#6a7a6a" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <div className="flex items-center gap-2 flex-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#6a7a6a" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => { setTempEnd(e.target.value); setSelectedPreset('custom'); }}
                    className="px-2 py-1.5 text-sm rounded-md w-32 focus:outline-none focus:ring-1 focus:ring-[#5d8a66]"
                    style={{
                      backgroundColor: '#252a25',
                      border: '1px solid #3a453a',
                      color: '#c5d0c5',
                    }}
                  />
                </div>
                <button
                  onClick={handleApply}
                  className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors hover:brightness-110"
                  style={{
                    backgroundColor: '#5d8a66',
                    color: '#f5f0e6',
                  }}
                >
                  Apply
                </button>
              </div>

              {/* Two Calendars Side by Side */}
              <div className="flex gap-6">
                <MiniCalendar
                  month={leftMonth.month}
                  year={leftMonth.year}
                  selectedStart={tempStart}
                  selectedEnd={tempEnd}
                  onDateClick={handleDateClick}
                  onMonthChange={handleMonthChange}
                />
                <MiniCalendar
                  month={rightMonth.month}
                  year={rightMonth.year}
                  selectedStart={tempStart}
                  selectedEnd={tempEnd}
                  onDateClick={handleDateClick}
                  onMonthChange={(delta) => handleMonthChange(delta)}
                />
              </div>

              {/* Today Button & Data Notice */}
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #2a352a' }}>
                <button
                  onClick={goToToday}
                  className="text-xs font-medium transition-colors hover:brightness-125"
                  style={{ color: '#7ab886' }}
                >
                  TODAY
                </button>
                <span className="text-[10px]" style={{ color: '#5a6a5a' }}>
                  Data delayed {dataDelay} days from Google
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
