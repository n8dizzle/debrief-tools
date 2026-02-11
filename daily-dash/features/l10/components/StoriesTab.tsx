'use client';

import { useState } from 'react';
import { useStories, useRotation, usePortalUsers, RotationMember, StoryWeek } from '@/lib/hooks/useL10Data';

function formatWeekLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function StoriesTab() {
  const { data: stories, isLoading, mutate: mutateStories } = useStories();
  const { members, mutate: mutateRotation } = useRotation();
  const { users } = usePortalUsers();
  const [showRotation, setShowRotation] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState('');
  const [editDate, setEditDate] = useState('');

  const activeMembers = members?.filter((m) => m.is_active) || [];

  const startEdit = (week: StoryWeek) => {
    setEditingWeek(week.week_date);
    setEditMemberId(week.rotation_member_id || '');
    setEditDate(week.week_date);
  };

  const cancelEdit = () => {
    setEditingWeek(null);
    setEditMemberId('');
    setEditDate('');
  };

  const handleSaveEdit = async (originalDate: string) => {
    const member = activeMembers.find((m) => m.id === editMemberId);
    await fetch('/api/l10/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_date: originalDate,
        action: 'edit',
        rotation_member_id: editMemberId || undefined,
        member_name: member?.member_name || undefined,
        new_date: editDate !== originalDate ? editDate : undefined,
      }),
    });
    cancelEdit();
    mutateStories();
  };

  const handleMarkTold = async (weekDate: string) => {
    await fetch('/api/l10/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_date: weekDate, action: 'mark_told' }),
    });
    mutateStories();
  };

  const handleAddMember = async () => {
    if (!newMemberUserId) return;
    const user = users?.find((u) => u.id === newMemberUserId);
    if (!user) return;
    await fetch('/api/l10/stories/rotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_name: user.name || user.email,
        user_id: newMemberUserId,
      }),
    });
    setNewMemberUserId('');
    mutateRotation();
    mutateStories();
  };

  const handleToggleActive = async (member: RotationMember) => {
    await fetch(`/api/l10/stories/rotation/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !member.is_active }),
    });
    mutateRotation();
    mutateStories();
  };

  const handleDeleteMember = async (id: string) => {
    await fetch(`/api/l10/stories/rotation/${id}`, { method: 'DELETE' });
    mutateRotation();
    mutateStories();
  };

  const handleMoveUp = async (member: RotationMember, index: number) => {
    if (!members || index === 0) return;
    const prev = members[index - 1];
    await fetch('/api/l10/stories/rotation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: [
          { id: member.id, display_order: prev.display_order },
          { id: prev.id, display_order: member.display_order },
        ],
      }),
    });
    mutateRotation();
    mutateStories();
  };

  const handleMoveDown = async (member: RotationMember, index: number) => {
    if (!members || index === members.length - 1) return;
    const next = members[index + 1];
    await fetch('/api/l10/stories/rotation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: [
          { id: member.id, display_order: next.display_order },
          { id: next.id, display_order: member.display_order },
        ],
      }),
    });
    mutateRotation();
    mutateStories();
  };

  // Inline edit form used for both current and upcoming weeks
  const renderEditForm = (week: StoryWeek, compact: boolean) => (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <select
        value={editMemberId}
        onChange={(e) => setEditMemberId(e.target.value)}
        className={`w-full rounded ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
      >
        <option value="">Select person...</option>
        {activeMembers.map((m) => (
          <option key={m.id} value={m.id}>{m.member_name}</option>
        ))}
      </select>
      <input
        type="date"
        value={editDate}
        onChange={(e) => setEditDate(e.target.value)}
        className={`w-full rounded ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
      />
      <div className="flex gap-1">
        <button
          onClick={() => handleSaveEdit(week.week_date)}
          disabled={!editMemberId}
          className={`flex-1 rounded font-medium disabled:opacity-50 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
          style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
        >
          Save
        </button>
        <button
          onClick={cancelEdit}
          className={`rounded ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div>
      {/* Current week card */}
      {stories?.current_week && (
        <div
          className="rounded-lg p-6 mb-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '2px solid var(--christmas-green)',
          }}
        >
          <div className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--christmas-green)' }}>
            This Week &mdash; {formatWeekLabel(stories.current_week.week_date)}
          </div>

          {editingWeek === stories.current_week.week_date ? (
            renderEditForm(stories.current_week, false)
          ) : (
            <>
              <button
                onClick={() => startEdit(stories.current_week)}
                className="block text-left mb-4 group"
              >
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {stories.current_week.member_name}
                </div>
                <div className="text-xs mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                  click to edit
                </div>
              </button>
              <button
                onClick={() => handleMarkTold(stories.current_week.week_date)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: stories.current_week.is_told ? 'var(--christmas-green)' : 'var(--bg-secondary)',
                  color: stories.current_week.is_told ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  border: `1px solid ${stories.current_week.is_told ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
                }}
              >
                {stories.current_week.is_told ? 'Told' : 'Mark as Told'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Upcoming weeks */}
      {stories?.upcoming && stories.upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            Upcoming
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {stories.upcoming.map((week) => (
              <div
                key={week.week_date}
                className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                {editingWeek === week.week_date ? (
                  renderEditForm(week, true)
                ) : (
                  <>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      {formatWeekLabel(week.week_date)}
                    </div>
                    <button
                      onClick={() => startEdit(week)}
                      className="w-full text-left group"
                    >
                      <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {week.member_name}
                      </div>
                      <div className="text-xs mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                        click to edit
                      </div>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past stories */}
      {stories?.past && stories.past.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            Past Weeks
          </h3>
          <div className="space-y-1">
            {stories.past.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                {entry.is_told ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="var(--christmas-green)" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                    &mdash;
                  </span>
                )}
                <span className="text-xs w-28" style={{ color: 'var(--text-muted)' }}>
                  {formatWeekLabel(entry.week_date)}
                </span>
                <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                  {entry.member_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage rotation */}
      <div>
        <button
          onClick={() => setShowRotation(!showRotation)}
          className="flex items-center gap-2 text-sm font-medium mb-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showRotation ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Manage Rotation ({members?.length || 0} members)
        </button>

        {showRotation && (
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Add member */}
            <div className="flex gap-2 mb-4">
              <select
                value={newMemberUserId}
                onChange={(e) => setNewMemberUserId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Add team member...</option>
                {users
                  ?.filter((u) => !members?.some((m) => m.user_id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!newMemberUserId}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
              >
                Add
              </button>
            </div>

            {/* Member list */}
            <div className="space-y-1">
              {members?.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: member.is_active ? 1 : 0.5,
                  }}
                >
                  <span className="text-xs w-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm" style={{ color: 'var(--christmas-cream)' }}>
                    {member.member_name}
                  </span>

                  <button
                    onClick={() => handleMoveUp(member, index)}
                    disabled={index === 0}
                    className="p-1 disabled:opacity-30"
                    style={{ color: 'var(--text-muted)' }}
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(member, index)}
                    disabled={index === (members?.length || 0) - 1}
                    className="p-1 disabled:opacity-30"
                    style={{ color: 'var(--text-muted)' }}
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleToggleActive(member)}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      color: member.is_active ? 'var(--christmas-green)' : 'var(--text-muted)',
                    }}
                    title={member.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </button>

                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="p-1"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {!members?.length && (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                No rotation members yet. Add someone above to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
