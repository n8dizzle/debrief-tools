'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRatingsHistory } from '@/lib/hooks/useL10Data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTuesday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -5 : 2 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getThisTuesday(): string {
  return formatLocalDate(getTuesday(new Date()));
}

function getLastTuesday(): string {
  const tuesday = getTuesday(new Date());
  tuesday.setDate(tuesday.getDate() - 7);
  return formatLocalDate(tuesday);
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return 'var(--christmas-green)';
  if (rating >= 6) return 'var(--christmas-gold)';
  return '#EF4444';
}

function getRatingBg(rating: number): string {
  if (rating >= 8) return 'rgba(34, 139, 34, 0.15)';
  if (rating >= 6) return 'rgba(218, 165, 32, 0.15)';
  return 'rgba(239, 68, 68, 0.15)';
}

function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get first name from full name
function firstName(name: string): string {
  return name.split(' ')[0];
}

export default function RatingsTab() {
  const { data: historyData, isLoading: historyLoading, mutate: mutateHistory } = useRatingsHistory();

  // Entry form state
  const [selectedDate, setSelectedDate] = useState(getThisTuesday());
  const [formRatings, setFormRatings] = useState<Record<string, string>>({});
  const [feedbackNote, setFeedbackNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // L10 participants - derived from history data (everyone who's ever had a rating)
  const participants = historyData?.participants || [];

  // Load existing ratings when date changes
  const loadDateRatings = useCallback((date: string) => {
    if (!historyData?.meetings) return;
    const meeting = historyData.meetings.find((m) => m.meeting_date === date);
    const newRatings: Record<string, string> = {};
    if (meeting) {
      meeting.ratings.forEach((r) => {
        newRatings[r.user_id] = String(r.rating);
      });
      setFeedbackNote(meeting.feedback_note || '');
    } else {
      setFeedbackNote('');
    }
    setFormRatings(newRatings);
  }, [historyData]);

  useEffect(() => {
    loadDateRatings(selectedDate);
  }, [selectedDate, loadDateRatings]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSaveMessage(null);
  };

  const handleRowClick = (meetingDate: string) => {
    setSelectedDate(meetingDate);
    setSaveMessage(null);
    // Scroll to top of form
    document.getElementById('rating-entry-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRatingChange = (userId: string, value: string) => {
    // Allow empty, or numbers 1-10 (including decimals)
    if (value === '' || (/^\d{1,2}(\.\d{0,2})?$/.test(value) && Number(value) >= 1 && Number(value) <= 10)) {
      setFormRatings((prev) => ({ ...prev, [userId]: value }));
    }
  };

  const handleSave = async () => {
    // Build ratings array from form state (only non-empty)
    const ratingsToSubmit = participants
      .filter((p) => formRatings[p.user_id] && formRatings[p.user_id] !== '')
      .map((p) => ({
        user_id: p.user_id,
        user_name: p.user_name,
        rating: Number(formRatings[p.user_id]),
      }));

    if (ratingsToSubmit.length === 0) {
      setSaveMessage({ type: 'error', text: 'Enter at least one rating' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/l10/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_date: selectedDate,
          ratings: ratingsToSubmit,
          feedback_note: feedbackNote,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setSaveMessage({ type: 'success', text: `Saved ${ratingsToSubmit.length} ratings` });
      mutateHistory();
    } catch (err) {
      setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Trend chart data (last 12 weeks from history)
  const trendData = (historyData?.meetings || [])
    .slice()
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
    .slice(-12)
    .map((m) => ({
      label: formatDateLabel(m.meeting_date),
      average: m.average,
      meeting_date: m.meeting_date,
    }));

  const thisTuesday = getThisTuesday();
  const lastTuesday = getLastTuesday();

  return (
    <div>
      {/* A. Rating Entry Form */}
      <div
        id="rating-entry-form"
        className="rounded-lg p-5 mb-6"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Enter Ratings
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDateFull(selectedDate)}
          </div>
        </div>

        {/* Date selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => handleDateSelect(thisTuesday)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedDate === thisTuesday ? 'var(--christmas-green)' : 'var(--bg-secondary)',
              color: selectedDate === thisTuesday ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              border: `1px solid ${selectedDate === thisTuesday ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            }}
          >
            This Week
          </button>
          <button
            onClick={() => handleDateSelect(lastTuesday)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedDate === lastTuesday ? 'var(--christmas-green)' : 'var(--bg-secondary)',
              color: selectedDate === lastTuesday ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              border: `1px solid ${selectedDate === lastTuesday ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            }}
          >
            Last Week
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                handleDateSelect(formatLocalDate(getTuesday(date)));
              }
            }}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
          />
        </div>

        {/* Participant rating inputs */}
        {historyLoading ? (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading participants...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {participants.map((p) => (
              <div key={p.user_id} className="flex flex-col gap-1">
                <label className="text-xs truncate" style={{ color: 'var(--text-muted)' }} title={p.user_name}>
                  {firstName(p.user_name)}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step="0.5"
                  value={formRatings[p.user_id] || ''}
                  onChange={(e) => handleRatingChange(p.user_id, e.target.value)}
                  placeholder="—"
                  className="w-full px-2 py-1.5 rounded text-center text-sm font-bold"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: formRatings[p.user_id] ? getRatingColor(Number(formRatings[p.user_id])) : 'var(--text-muted)',
                    border: `1px solid ${formRatings[p.user_id] ? getRatingColor(Number(formRatings[p.user_id])) : 'var(--border-subtle)'}`,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Feedback note */}
        <textarea
          value={feedbackNote}
          onChange={(e) => setFeedbackNote(e.target.value)}
          placeholder="Feedback note (optional)..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm mb-3 resize-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--christmas-cream)',
            border: '1px solid var(--border-subtle)',
          }}
        />

        {/* Save button + message */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: saving ? 'var(--bg-secondary)' : 'var(--christmas-green)',
              color: saving ? 'var(--text-muted)' : 'white',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Ratings'}
          </button>
          {saveMessage && (
            <span
              className="text-sm"
              style={{ color: saveMessage.type === 'success' ? 'var(--christmas-green)' : '#EF4444' }}
            >
              {saveMessage.text}
            </span>
          )}
        </div>
      </div>

      {/* B. Weekly Trend Chart */}
      {trendData.length > 1 && (
        <div
          className="rounded-lg p-4 mb-6"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
            Weekly Trend
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: '#fff', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [<span style={{ color: '#fff' }}>{Number(value ?? 0).toFixed(1)}</span>, 'Average']}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <ReferenceLine y={8} stroke="var(--christmas-green)" strokeDasharray="3 3" opacity={0.5} />
                <Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {trendData.map((entry, index) => (
                    <Cell key={index} fill={getRatingColor(entry.average)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* C. Historical Ratings Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="p-4 pb-2">
          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Rating History
          </div>
        </div>

        {historyLoading ? (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : !historyData?.meetings?.length ? (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No ratings yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: participants.length > 6 ? `${600 + participants.length * 60}px` : undefined }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th
                    className="text-left px-4 py-2 text-xs font-medium sticky left-0 z-10"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)' }}
                  >
                    Date
                  </th>
                  <th
                    className="text-center px-3 py-2 text-xs font-medium sticky z-10"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', left: '90px' }}
                  >
                    AVG
                  </th>
                  {participants.map((p) => (
                    <th
                      key={p.user_id}
                      className="text-center px-2 py-2 text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}
                      title={p.user_name}
                    >
                      {firstName(p.user_name)}
                    </th>
                  ))}
                  <th
                    className="text-left px-3 py-2 text-xs font-medium"
                    style={{ color: 'var(--text-muted)', minWidth: '120px' }}
                  >
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyData.meetings.map((meeting) => {
                  const isSelected = meeting.meeting_date === selectedDate;
                  // Build a lookup for this meeting's ratings
                  const ratingMap = new Map<string, number>();
                  meeting.ratings.forEach((r) => ratingMap.set(r.user_id, r.rating));

                  return (
                    <tr
                      key={meeting.meeting_date}
                      onClick={() => handleRowClick(meeting.meeting_date)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isSelected ? 'rgba(34, 139, 34, 0.08)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected ? 'rgba(34, 139, 34, 0.08)' : '';
                      }}
                    >
                      <td
                        className="px-4 py-2 font-medium whitespace-nowrap sticky left-0 z-10"
                        style={{ color: 'var(--christmas-cream)', backgroundColor: isSelected ? 'rgba(34, 139, 34, 0.08)' : 'var(--bg-card)' }}
                      >
                        {formatDateLabel(meeting.meeting_date)}
                      </td>
                      <td
                        className="text-center px-3 py-2 font-bold sticky z-10"
                        style={{
                          color: getRatingColor(meeting.average),
                          backgroundColor: isSelected ? 'rgba(34, 139, 34, 0.08)' : 'var(--bg-card)',
                          left: '90px',
                        }}
                      >
                        {meeting.average.toFixed(1)}
                      </td>
                      {participants.map((p) => {
                        const rating = ratingMap.get(p.user_id);
                        return (
                          <td key={p.user_id} className="text-center px-2 py-2">
                            {rating ? (
                              <span
                                className="inline-block w-7 h-7 leading-7 rounded text-xs font-bold"
                                style={{
                                  backgroundColor: getRatingBg(rating),
                                  color: getRatingColor(rating),
                                }}
                              >
                                {rating}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className="px-3 py-2 text-xs truncate max-w-[200px]"
                        style={{ color: 'var(--text-muted)' }}
                        title={meeting.feedback_note || ''}
                      >
                        {meeting.feedback_note || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
