'use client';

import { useState } from 'react';

interface NotificationPreferencesProps {
  trackingCode: string;
  initialSms: boolean;
  initialEmail: boolean;
  initialPhone: string | null;
  initialEmailAddr: string | null;
}

export default function NotificationPreferences({
  trackingCode,
  initialSms,
  initialEmail,
  initialPhone,
  initialEmailAddr,
}: NotificationPreferencesProps) {
  const [notifySms, setNotifySms] = useState(initialSms);
  const [notifyEmail, setNotifyEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || '');
  const [email, setEmail] = useState(initialEmailAddr || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_code: trackingCode,
          notify_sms: notifySms,
          notify_email: notifyEmail,
          notification_phone: phone || null,
          notification_email: email || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save preferences');
      }

      setMessage({ type: 'success', text: 'Notification preferences saved!' });
      setIsExpanded(false);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="font-medium text-gray-900">Notification Preferences</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <p className="text-sm text-gray-600 mt-4 mb-4">
            Choose how you&apos;d like to be notified when your job progresses.
          </p>

          {/* SMS Option */}
          <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={notifySms}
              onChange={(e) => setNotifySms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">Text Messages (SMS)</span>
              <p className="text-sm text-gray-500">Get text updates on your phone</p>
              {notifySms && (
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(512) 555-1234"
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              )}
            </div>
          </label>

          {/* Email Option */}
          <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">Email</span>
              <p className="text-sm text-gray-500">Get email updates</p>
              {notifyEmail && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              )}
            </div>
          </label>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full py-2.5 px-4 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}
    </div>
  );
}
