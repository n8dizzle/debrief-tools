'use client';

import { useState, useEffect, useCallback } from 'react';

interface NotesInputProps {
  kpiId: string;
  date: string;
  initialValue: string | null;
  onSave?: (value: string) => void;
  disabled?: boolean;
}

export default function NotesInput({
  kpiId,
  date,
  initialValue,
  onSave,
  disabled = false,
}: NotesInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Reset value when initialValue changes (e.g., date change)
  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue, kpiId, date]);

  // Debounced save
  const saveNote = useCallback(async () => {
    if (disabled) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/huddle/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpi_id: kpiId,
          note_date: date,
          note_text: value,
        }),
      });

      if (response.ok) {
        setLastSaved(new Date().toLocaleTimeString());
        onSave?.(value);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [kpiId, date, value, disabled, onSave]);

  // Auto-save on blur
  const handleBlur = () => {
    if (value !== initialValue) {
      saveNote();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        disabled={disabled}
        placeholder={disabled ? '' : 'Add note...'}
        className="w-full px-2 py-1 text-sm rounded border transition-colors"
        style={{
          backgroundColor: disabled ? 'transparent' : 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      />
      {isSaving && (
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Saving...
        </span>
      )}
    </div>
  );
}
