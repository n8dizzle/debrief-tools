'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { JobTracker, TrackerMilestone, TrackerActivity, MilestoneStatus } from '@/lib/supabase';
import MilestoneEditor from './MilestoneEditor';

interface TrackerDetailProps {
  tracker: JobTracker & { milestones: TrackerMilestone[]; activity: TrackerActivity[] };
}

export default function TrackerDetail({ tracker }: TrackerDetailProps) {
  const router = useRouter();
  const [milestones, setMilestones] = useState(tracker.milestones);
  const [status, setStatus] = useState(tracker.status);
  const [progress, setProgress] = useState(tracker.progress_percent);
  const [updating, setUpdating] = useState(false);

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${tracker.tracking_code}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
  }

  async function updateMilestone(milestoneId: string, newStatus: MilestoneStatus, customerNotes?: string) {
    setUpdating(true);
    try {
      const response = await fetch(`/api/trackers/${tracker.id}/milestones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: milestoneId,
          status: newStatus,
          customer_notes: customerNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update milestone');
      }

      const data = await response.json();

      // Update local state
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? { ...m, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
            : m
        )
      );
      setProgress(data.progress_percent);
      setStatus(data.status);
    } catch (error) {
      console.error('Error updating milestone:', error);
    } finally {
      setUpdating(false);
    }
  }

  async function updateTrackerStatus(newStatus: string) {
    setUpdating(true);
    try {
      const response = await fetch(`/api/trackers/${tracker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      setStatus(newStatus as typeof status);
      router.refresh();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/trackers" className="text-text-muted hover:text-text-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">{tracker.customer_name}</h1>
            <span className={`badge ${tracker.trade === 'hvac' ? 'badge-hvac' : 'badge-plumbing'}`}>
              {tracker.trade.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            {tracker.job_number && <span>Job #{tracker.job_number}</span>}
            <span className="font-mono">{tracker.tracking_code}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={copyLink} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy Link
          </button>
          <Link href={publicUrl} target="_blank" className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View Public
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Progress</h2>
              <select
                value={status}
                onChange={(e) => updateTrackerStatus(e.target.value)}
                disabled={updating}
                className="select w-auto text-sm"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-3 bg-border-default rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tracker.trade === 'hvac' ? 'bg-christmas-green' : 'bg-christmas-gold'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-lg font-bold text-text-primary">{progress}%</span>
            </div>

            {/* Milestones */}
            <MilestoneEditor
              milestones={milestones}
              trade={tracker.trade}
              onUpdate={updateMilestone}
              disabled={updating}
            />
          </div>

          {/* Activity Log */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Activity Log</h2>
            {tracker.activity.length === 0 ? (
              <p className="text-text-muted text-sm">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {tracker.activity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-christmas-green mt-1.5" />
                    <div className="flex-1">
                      <p className="text-text-secondary">{activity.description}</p>
                      <p className="text-text-muted text-xs mt-0.5">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Job Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Job Details</h2>
            <dl className="space-y-3 text-sm">
              {tracker.job_number && (
                <div>
                  <dt className="text-text-muted">Job #</dt>
                  <dd className="text-text-primary flex items-center gap-1">
                    <span>{tracker.job_number}</span>
                    {tracker.st_job_id && (
                      <a
                        href={`https://go.servicetitan.com/#/Job/Index/${tracker.st_job_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-50 hover:opacity-100 transition-opacity"
                        title="View job in ServiceTitan"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-text-muted">Type</dt>
                <dd className="text-text-primary capitalize">{tracker.job_type}</dd>
              </div>
              {tracker.job_address && (
                <div>
                  <dt className="text-text-muted">Address</dt>
                  <dd className="text-text-primary">{tracker.job_address}</dd>
                </div>
              )}
              {tracker.scheduled_date && (
                <div>
                  <dt className="text-text-muted">Scheduled</dt>
                  <dd className="text-text-primary">
                    {new Date(tracker.scheduled_date).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {tracker.estimated_completion && (
                <div>
                  <dt className="text-text-muted">Est. Completion</dt>
                  <dd className="text-text-primary">
                    {new Date(tracker.estimated_completion).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {tracker.job_description && (
                <div>
                  <dt className="text-text-muted">Description</dt>
                  <dd className="text-text-primary">{tracker.job_description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Customer Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Customer</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-text-muted">Name</dt>
                <dd className="text-text-primary flex items-center gap-1">
                  <span>{tracker.customer_name}</span>
                  {tracker.st_customer_id && (
                    <a
                      href={`https://go.servicetitan.com/#/Customer/${tracker.st_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      title="View customer in ServiceTitan"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </dd>
              </div>
              {tracker.customer_email && (
                <div>
                  <dt className="text-text-muted">Email</dt>
                  <dd className="text-text-primary">
                    <a href={`mailto:${tracker.customer_email}`} className="hover:underline">
                      {tracker.customer_email}
                    </a>
                  </dd>
                </div>
              )}
              {tracker.customer_phone && (
                <div>
                  <dt className="text-text-muted">Phone</dt>
                  <dd className="text-text-primary">
                    <a href={`tel:${tracker.customer_phone}`} className="hover:underline">
                      {tracker.customer_phone}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notifications */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Notifications</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {tracker.notify_email ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="text-text-secondary">Email notifications</span>
              </div>
              <div className="flex items-center gap-2">
                {tracker.notify_sms ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="text-text-secondary">SMS notifications</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
