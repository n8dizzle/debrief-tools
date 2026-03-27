'use client';

import { useState, useEffect } from 'react';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DaySchedule {
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
}

const defaultSchedule: DaySchedule[] = [
  { day_of_week: 0, is_available: false, start_time: '09:00', end_time: '14:00' },
  { day_of_week: 1, is_available: true, start_time: '08:00', end_time: '17:00' },
  { day_of_week: 2, is_available: true, start_time: '08:00', end_time: '17:00' },
  { day_of_week: 3, is_available: true, start_time: '08:00', end_time: '17:00' },
  { day_of_week: 4, is_available: true, start_time: '08:00', end_time: '17:00' },
  { day_of_week: 5, is_available: true, start_time: '08:00', end_time: '17:00' },
  { day_of_week: 6, is_available: true, start_time: '09:00', end_time: '14:00' },
];

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [availRes, blockedRes] = await Promise.all([
          fetch('/api/availability'),
          fetch('/api/availability/blocked-dates'),
        ]);

        if (availRes.ok) {
          const availData = await availRes.json();
          if (availData.availability && availData.availability.length > 0) {
            // Map DB records to our schedule format, sorted by day_of_week
            const dbSchedule = availData.availability.map((a: DaySchedule) => ({
              day_of_week: a.day_of_week,
              is_available: a.is_available,
              start_time: a.start_time?.substring(0, 5) || '08:00',
              end_time: a.end_time?.substring(0, 5) || '17:00',
            }));
            // Ensure all 7 days are present
            const fullSchedule = defaultSchedule.map((def) => {
              const found = dbSchedule.find((d: DaySchedule) => d.day_of_week === def.day_of_week);
              return found || def;
            });
            setSchedule(fullSchedule);
          }
        }

        if (blockedRes.ok) {
          const blockedData = await blockedRes.json();
          setBlockedDates(blockedData.blocked_dates || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load availability');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function toggleDay(dayOfWeek: number) {
    setSchedule((prev) =>
      prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, is_available: !s.is_available } : s))
    );
  }

  function updateTime(dayOfWeek: number, field: 'start_time' | 'end_time', value: string) {
    setSchedule((prev) =>
      prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s))
    );
  }

  async function saveSchedule() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save schedule');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function addBlockedDate() {
    if (!newBlockDate) return;
    setAddingBlock(true);
    try {
      const res = await fetch('/api/availability/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocked_date: newBlockDate,
          reason: newBlockReason || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add blocked date');
      }
      const data = await res.json();
      setBlockedDates((prev) => [...prev, data.blocked_date]);
      setNewBlockDate('');
      setNewBlockReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddingBlock(false);
    }
  }

  async function removeBlockedDate(id: string) {
    try {
      const res = await fetch(`/api/availability/blocked-dates?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      setBlockedDates((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  // Reorder for display: Monday (1) through Sunday (0)
  const displayOrder = [1, 2, 3, 4, 5, 6, 0];
  const orderedSchedule = displayOrder.map((dow) =>
    schedule.find((s) => s.day_of_week === dow)!
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-default)',
            borderTopColor: 'var(--hw-blue)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading availability...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 0.25rem',
          }}
        >
          Availability
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Set your weekly schedule and block off dates when you&apos;re unavailable.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--status-error)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
        }}
      >
        {/* Weekly Schedule */}
        <div className="card">
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 1.25rem',
            }}
          >
            Weekly Schedule
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {orderedSchedule.map((day) => (
              <div
                key={day.day_of_week}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: day.is_available ? 'var(--bg-input)' : 'transparent',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: day.is_available ? 'var(--border-default)' : 'transparent',
                  opacity: day.is_available ? 1 : 0.5,
                }}
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleDay(day.day_of_week)}
                  style={{
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    border: 'none',
                    background: day.is_available ? 'var(--hw-blue)' : 'var(--border-default)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: day.is_available ? '20px' : '2px',
                      transition: 'left 0.15s ease',
                    }}
                  />
                </button>

                {/* Day Name */}
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    width: '100px',
                    flexShrink: 0,
                  }}
                >
                  {dayNames[day.day_of_week]}
                </span>

                {/* Time Inputs */}
                {day.is_available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="time"
                      className="input"
                      value={day.start_time}
                      onChange={(e) => updateTime(day.day_of_week, 'start_time', e.target.value)}
                      style={{ width: '130px' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>to</span>
                    <input
                      type="time"
                      className="input"
                      value={day.end_time}
                      onChange={(e) => updateTime(day.day_of_week, 'end_time', e.target.value)}
                      style={{ width: '130px' }}
                    />
                  </div>
                )}

                {!day.is_available && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Unavailable
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {saveSuccess && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--status-success)' }}>
                Schedule saved!
              </span>
            )}
            <button className="btn-primary" onClick={saveSchedule} disabled={saving}>
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* Blocked Dates */}
        <div className="card">
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 1.25rem',
            }}
          >
            Blocked Dates
          </h2>

          {/* Add Blocked Date */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <input
              type="date"
              className="input"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              style={{ width: '160px' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Reason (optional)"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={addBlockedDate} disabled={addingBlock || !newBlockDate}>
              {addingBlock ? '...' : 'Block'}
            </button>
          </div>

          {/* Blocked Dates List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {blockedDates.map((blocked) => (
              <div
                key={blocked.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {new Date(blocked.blocked_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {blocked.reason || 'Blocked'}
                  </div>
                </div>
                <button
                  onClick={() => removeBlockedDate(blocked.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                  }}
                  title="Remove"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {blockedDates.length === 0 && (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                No blocked dates. Add dates when you&apos;re unavailable.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
