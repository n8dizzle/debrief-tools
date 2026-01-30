import { notFound } from 'next/navigation';
import { getServerSupabase, PublicTrackerView } from '@/lib/supabase';
import TrackerTimeline from '@/components/public/TrackerTimeline';
import ProgressBar from '@/components/public/ProgressBar';
import NotificationPreferences from '@/components/public/NotificationPreferences';

interface PageProps {
  params: Promise<{ trackingCode: string }>;
}

async function getTracker(trackingCode: string): Promise<PublicTrackerView | null> {
  const supabase = getServerSupabase();

  // Fetch the tracker
  const { data: tracker, error } = await supabase
    .from('job_trackers')
    .select(`
      id,
      tracking_code,
      customer_name,
      job_address,
      trade,
      job_type,
      job_description,
      status,
      progress_percent,
      scheduled_date,
      estimated_completion,
      actual_completion,
      notify_sms,
      notify_email,
      notification_phone,
      notification_email
    `)
    .eq('tracking_code', trackingCode)
    .single();

  if (error || !tracker) {
    return null;
  }

  // Fetch milestones
  const { data: milestones } = await supabase
    .from('tracker_milestones')
    .select(`
      id,
      name,
      description,
      icon,
      sort_order,
      status,
      completed_at,
      customer_notes
    `)
    .eq('tracker_id', tracker.id)
    .order('sort_order', { ascending: true });

  return {
    ...tracker,
    milestones: milestones || [],
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getJobTypeLabel(jobType: string): string {
  const labels: Record<string, string> = {
    install: 'Installation',
    repair: 'Repair',
    maintenance: 'Maintenance',
    service: 'Service Call',
  };
  return labels[jobType] || jobType;
}

function getStatusBadge(status: string) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'On Hold' },
  };
  const style = styles[status] || styles.active;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export default async function TrackerPage({ params }: PageProps) {
  const { trackingCode } = await params;
  const tracker = await getTracker(trackingCode);

  if (!tracker) {
    notFound();
  }

  const tradeColor = tracker.trade === 'hvac' ? '#5D8A66' : '#B8956B';
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: tradeColor }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {tracker.trade === 'hvac' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              )}
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Christmas Air</h1>
          <p className="text-gray-600 mt-1">
            {tradeName} {getJobTypeLabel(tracker.job_type)}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Status Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Hello, {tracker.customer_name.split(' ')[0]}</p>
              <p className="font-semibold text-gray-900">Your job is {tracker.status === 'active' ? 'in progress' : tracker.status}</p>
            </div>
            {getStatusBadge(tracker.status)}
          </div>

          {/* Progress Section */}
          <div className="px-6 py-5 border-b border-gray-100">
            <ProgressBar progress={tracker.progress_percent} trade={tracker.trade} />
          </div>

          {/* Job Details */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {tracker.job_address && (
                <div className="col-span-2">
                  <p className="text-gray-500">Service Address</p>
                  <p className="font-medium text-gray-900">{tracker.job_address}</p>
                </div>
              )}
              {tracker.scheduled_date && (
                <div>
                  <p className="text-gray-500">Scheduled Date</p>
                  <p className="font-medium text-gray-900">{formatDate(tracker.scheduled_date)}</p>
                </div>
              )}
              {tracker.estimated_completion && (
                <div>
                  <p className="text-gray-500">Est. Completion</p>
                  <p className="font-medium text-gray-900">{formatDate(tracker.estimated_completion)}</p>
                </div>
              )}
              {tracker.actual_completion && (
                <div>
                  <p className="text-gray-500">Completed On</p>
                  <p className="font-medium text-gray-900">{formatDate(tracker.actual_completion)}</p>
                </div>
              )}
            </div>
            {tracker.job_description && (
              <div className="mt-4">
                <p className="text-gray-500 text-sm">Job Description</p>
                <p className="text-gray-900">{tracker.job_description}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Progress Timeline</h2>
            <TrackerTimeline milestones={tracker.milestones} trade={tracker.trade} />
          </div>
        </div>

        {/* Notification Preferences */}
        <NotificationPreferences
          trackingCode={tracker.tracking_code}
          initialSms={tracker.notify_sms}
          initialEmail={tracker.notify_email}
          initialPhone={tracker.notification_phone}
          initialEmailAddr={tracker.notification_email}
        />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Questions? Call us at (512) 439-1616</p>
          <p className="mt-1">
            <a href="https://christmasair.com" className="hover:underline" style={{ color: tradeColor }}>
              christmasair.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
