'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface QueuedNotification {
  id: string;
  notification_type: 'sms' | 'email';
  recipient: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
  metadata: { category?: string } | null;
  tracker: {
    id: string;
    tracking_code: string;
    customer_name: string;
    trade: 'hvac' | 'plumbing';
    job_type: string;
  } | null;
}

export default function NotificationsQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<QueuedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'queued' | 'sent' | 'discarded'>('queued');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications/queue?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'discard') => {
    setProcessing(id);
    try {
      const response = await fetch('/api/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      if (response.ok) {
        // Remove from list
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to process notification:', error);
      alert('Failed to process notification');
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm(`Approve and send all ${notifications.length} notifications?`)) {
      return;
    }

    for (const notification of notifications) {
      await handleAction(notification.id, 'approve');
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'welcome':
        return 'Welcome';
      case 'milestone':
        return 'Progress Update';
      case 'completion':
        return 'Completion';
      default:
        return 'Notification';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'welcome':
        return 'bg-blue-500/20 text-blue-400';
      case 'milestone':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'completion':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-christmas-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notification Queue</h1>
          <p className="text-text-secondary mt-1">
            Review and approve notifications before they are sent
          </p>
        </div>
        {filter === 'queued' && notifications.length > 0 && (
          <button
            onClick={handleApproveAll}
            className="px-4 py-2 bg-christmas-green text-white rounded-lg hover:bg-christmas-green/90 transition-colors"
          >
            Approve All ({notifications.length})
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['queued', 'sent', 'discarded'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === tab
                ? 'bg-christmas-green text-white'
                : 'bg-bg-card text-text-secondary hover:bg-bg-card/80'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <svg
            className="w-12 h-12 mx-auto text-text-muted mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-text-secondary">
            {filter === 'queued'
              ? 'No notifications waiting for approval'
              : `No ${filter} notifications`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header Row */}
                  <div className="flex items-center gap-2 mb-2">
                    {/* Type Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        notification.notification_type === 'email'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {notification.notification_type === 'email' ? 'Email' : 'SMS'}
                    </span>
                    {/* Category Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                        notification.metadata?.category
                      )}`}
                    >
                      {getCategoryLabel(notification.metadata?.category)}
                    </span>
                    {/* Trade Badge */}
                    {notification.tracker && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          notification.tracker.trade === 'hvac'
                            ? 'bg-christmas-green/20 text-christmas-green-light'
                            : 'bg-christmas-gold/20 text-christmas-gold'
                        }`}
                      >
                        {notification.tracker.trade.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Customer & Recipient */}
                  <div className="mb-2">
                    <p className="font-medium text-text-primary">
                      {notification.tracker?.customer_name || 'Unknown Customer'}
                    </p>
                    <p className="text-sm text-text-secondary">{notification.recipient}</p>
                  </div>

                  {/* Subject (for emails) */}
                  {notification.subject && (
                    <p className="text-sm font-medium text-text-primary mb-1">
                      {notification.subject}
                    </p>
                  )}

                  {/* Message Preview */}
                  <p className="text-sm text-text-secondary line-clamp-2">
                    {notification.message}
                  </p>

                  {/* Timestamp */}
                  <p className="text-xs text-text-muted mt-2">
                    Created{' '}
                    {new Date(notification.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Actions */}
                {filter === 'queued' && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAction(notification.id, 'approve')}
                      disabled={processing === notification.id}
                      className="px-3 py-1.5 bg-christmas-green text-white text-sm rounded-lg hover:bg-christmas-green/90 transition-colors disabled:opacity-50"
                    >
                      {processing === notification.id ? 'Sending...' : 'Approve & Send'}
                    </button>
                    <button
                      onClick={() => handleAction(notification.id, 'discard')}
                      disabled={processing === notification.id}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
