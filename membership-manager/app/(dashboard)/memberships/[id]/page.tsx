'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MMMembership, MMRecurringService, MMRecurringServiceEvent, MMStaffNote } from '@/lib/supabase';
import { formatDate, formatTimestamp, getStatusBadgeStyle, getTradeFromServiceName } from '@/lib/mm-utils';
import { useMembershipPermissions } from '@/hooks/useMembershipPermissions';

interface DetailData {
  membership: MMMembership;
  services: MMRecurringService[];
  events: MMRecurringServiceEvent[];
  notes: MMStaffNote[];
}

export default function MembershipDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { canManageNotes, user } = useMembershipPermissions();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/memberships/${id}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load membership:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setSavingNote(true);
    try {
      const res = await fetch(`/api/memberships/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      if (res.ok) {
        setNoteContent('');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-2" style={{ color: 'var(--christmas-green)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading membership...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Membership not found.</p>
        <Link href="/memberships" className="btn btn-secondary mt-4">Back to Memberships</Link>
      </div>
    );
  }

  const { membership, services, events, notes } = data;
  const badgeStyle = getStatusBadgeStyle(membership.status);

  // Group events by service
  const eventsByService = new Map<number, MMRecurringServiceEvent[]>();
  for (const event of events) {
    const svcId = event.st_service_id || 0;
    if (!eventsByService.has(svcId)) {
      eventsByService.set(svcId, []);
    }
    eventsByService.get(svcId)!.push(event);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/memberships"
          className="text-sm flex items-center gap-1"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Memberships
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {membership.customer_name || 'Unknown Customer'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {membership.membership_type_name || 'Unknown Type'}
          </p>
        </div>
        <span className="badge text-sm" style={badgeStyle}>
          {membership.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Customer Info */}
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Customer Info
          </h2>
          <div className="space-y-2">
            <InfoRow label="Name" value={membership.customer_name} />
            <InfoRow label="Phone" value={membership.customer_phone} />
            <InfoRow label="Email" value={membership.customer_email} />
            <InfoRow label="Address" value={membership.customer_address} />
          </div>
        </div>

        {/* Membership Details */}
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Membership Details
          </h2>
          <div className="space-y-2">
            <InfoRow label="Type" value={membership.membership_type_name} />
            <InfoRow label="Status" value={membership.status} />
            <InfoRow label="Start Date" value={formatDate(membership.start_date)} />
            <InfoRow label="End Date" value={formatDate(membership.end_date)} />
            <InfoRow label="Billing" value={membership.billing_frequency} />
            {membership.days_until_expiry != null && (
              <InfoRow
                label="Days to Expiry"
                value={String(membership.days_until_expiry)}
                valueColor={
                  membership.days_until_expiry <= 0 ? 'var(--status-error)'
                  : membership.days_until_expiry <= 30 ? 'var(--status-warning)'
                  : 'var(--status-success)'
                }
              />
            )}
          </div>
        </div>

        {/* Visit Summary */}
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Visit Summary
          </h2>
          <div className="space-y-2">
            <InfoRow label="Expected Visits" value={String(membership.total_visits_expected)} />
            <InfoRow label="Completed" value={String(membership.total_visits_completed)} valueColor="var(--status-success)" />
            <InfoRow label="Scheduled" value={String(membership.total_visits_scheduled)} valueColor="var(--status-info)" />
            <InfoRow label="Next Due" value={formatDate(membership.next_visit_due_date)} />
          </div>
        </div>
      </div>

      {/* Visit Timeline */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Visit Timeline
        </h2>
        {services.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recurring services found.</p>
        ) : (
          <div className="space-y-6">
            {services.map((service) => {
              const svcEvents = eventsByService.get(service.st_service_id) || [];
              const trade = getTradeFromServiceName(service.name);
              const tradeColor = trade === 'plumbing' ? 'var(--christmas-gold)' : 'var(--christmas-green)';

              return (
                <div key={service.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: tradeColor }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{service.name}</span>
                    <span className="text-xs badge" style={{ background: `${tradeColor}20`, color: tradeColor }}>
                      {trade === 'plumbing' ? 'Plumbing' : trade === 'hvac' ? 'HVAC' : 'Other'}
                    </span>
                  </div>

                  {svcEvents.length === 0 ? (
                    <p className="text-sm ml-5" style={{ color: 'var(--text-muted)' }}>No events recorded</p>
                  ) : (
                    <div className="ml-5 space-y-2">
                      {svcEvents
                        .sort((a, b) => {
                          const aDate = a.scheduled_date || a.completed_date || '';
                          const bDate = b.scheduled_date || b.completed_date || '';
                          return aDate.localeCompare(bDate);
                        })
                        .map((event) => {
                          const isDone = event.status === 'Done' || event.status === 'Completed';
                          const isScheduled = event.status === 'Scheduled';

                          return (
                            <div
                              key={event.id}
                              className="flex items-center gap-3 p-2 rounded-lg"
                              style={{ background: 'var(--bg-secondary)' }}
                            >
                              {isDone ? (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="var(--status-success)" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : isScheduled ? (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="var(--status-info)" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                                </svg>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                  {event.name || service.name}
                                </span>
                              </div>
                              <span className="text-sm flex-shrink-0" style={{
                                color: isDone ? 'var(--status-success)' : isScheduled ? 'var(--status-info)' : 'var(--text-muted)'
                              }}>
                                {isDone
                                  ? `Completed ${formatDate(event.completed_date)}`
                                  : isScheduled
                                  ? `Scheduled ${formatDate(event.scheduled_date)}`
                                  : event.status
                                }
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Notes */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Staff Notes
        </h2>

        {canManageNotes && (
          <form onSubmit={handleAddNote} className="mb-4">
            <div className="flex gap-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a note about this membership..."
                className="input flex-1"
                rows={2}
                style={{ resize: 'vertical' }}
              />
              <button
                type="submit"
                disabled={savingNote || !noteContent.trim()}
                className="btn btn-primary self-end"
                style={{ opacity: savingNote || !noteContent.trim() ? 0.5 : 1 }}
              >
                {savingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                    {note.author_name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatTimestamp(note.created_at)}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | null | undefined;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: valueColor || 'var(--text-primary)' }}>
        {value || '—'}
      </span>
    </div>
  );
}
