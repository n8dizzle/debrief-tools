'use client';

import { useState, useRef, useEffect } from 'react';

interface DepartmentFilterProps {
  departments: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function DepartmentFilter({ departments, selected, onChange }: DepartmentFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (dept: string) => {
    if (selected.includes(dept)) {
      onChange(selected.filter(d => d !== dept));
    } else {
      onChange([...selected, dept]);
    }
  };

  const label = selected.length === 0
    ? 'All Departments'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} Departments`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
        style={{
          backgroundColor: selected.length > 0 ? 'var(--christmas-green)' : 'var(--bg-card)',
          color: selected.length > 0 ? 'var(--christmas-cream)' : 'var(--text-secondary)',
          border: `1px solid ${selected.length > 0 ? 'var(--christmas-green)' : 'var(--border-default)'}`,
          minWidth: '160px',
        }}
      >
        <span className="truncate">{label}</span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && departments.length > 0 && (
        <div
          className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            minWidth: '220px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* Clear / Select All */}
          <div
            className="flex items-center justify-between px-3 py-2 text-xs"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <button
              onClick={() => onChange([])}
              className="font-medium hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear All
            </button>
            <button
              onClick={() => onChange([...departments])}
              className="font-medium hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Select All
            </button>
          </div>

          {departments.map(dept => {
            const isSelected = selected.includes(dept);
            return (
              <button
                key={dept}
                onClick={() => toggle(dept)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  color: isSelected ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  backgroundColor: isSelected ? 'rgba(93, 138, 102, 0.1)' : 'transparent',
                }}
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{
                    border: `1.5px solid ${isSelected ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                    backgroundColor: isSelected ? 'var(--christmas-green)' : 'transparent',
                  }}
                >
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="truncate">{dept}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
