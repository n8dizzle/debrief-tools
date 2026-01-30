'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Setting {
  key: string;
  value: boolean | string;
  description: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(key);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        setSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, value } : s))
        );
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
    } finally {
      setSaving(null);
    }
  };

  const getSettingValue = (key: string): boolean => {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return false;
    return setting.value === true || setting.value === 'true';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-christmas-green" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Configure job tracker settings</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Notification Queue Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Notification Queue</h2>
          <p className="text-sm text-text-muted mb-4">
            Control when notifications are sent to customers
          </p>
          <div className="space-y-4">
            <ToggleSetting
              label="Require Queue Approval"
              description="All notifications must be manually approved before sending"
              enabled={getSettingValue('require_queue_approval')}
              onChange={(value) => updateSetting('require_queue_approval', value)}
              saving={saving === 'require_queue_approval'}
            />
          </div>
        </div>

        {/* Auto-Send Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Auto-Send Notifications</h2>
          <p className="text-sm text-text-muted mb-4">
            When queue approval is disabled, these control automatic sending
          </p>
          <div className="space-y-4">
            <ToggleSetting
              label="Welcome Notifications"
              description="Automatically send welcome email/SMS when a tracker is created"
              enabled={getSettingValue('auto_send_welcome')}
              onChange={(value) => updateSetting('auto_send_welcome', value)}
              saving={saving === 'auto_send_welcome'}
              disabled={getSettingValue('require_queue_approval')}
            />
            <ToggleSetting
              label="Milestone Updates"
              description="Automatically notify customers when milestones are completed"
              enabled={getSettingValue('auto_send_milestone')}
              onChange={(value) => updateSetting('auto_send_milestone', value)}
              saving={saving === 'auto_send_milestone'}
              disabled={getSettingValue('require_queue_approval')}
            />
            <ToggleSetting
              label="Completion Notifications"
              description="Automatically send notification when job is marked complete"
              enabled={getSettingValue('auto_send_completion')}
              onChange={(value) => updateSetting('auto_send_completion', value)}
              saving={saving === 'auto_send_completion'}
              disabled={getSettingValue('require_queue_approval')}
            />
          </div>
          {getSettingValue('require_queue_approval') && (
            <p className="text-xs text-text-muted mt-4 p-3 bg-bg-secondary rounded-lg">
              These settings are disabled while "Require Queue Approval" is enabled.
              All notifications will go to the queue for manual review.
            </p>
          )}
        </div>

        {/* Integration Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Integration Status</h2>
          <div className="space-y-3">
            <StatusRow
              label="Email (Resend)"
              description="Send email notifications"
              configured={true}
            />
            <StatusRow
              label="SMS (Dialpad)"
              description="Send text message notifications"
              configured={false}
              note="External SMS pending setup"
            />
            <StatusRow
              label="ServiceTitan"
              description="Auto-create trackers for jobs"
              configured={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  enabled,
  onChange,
  saving,
  disabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 bg-bg-secondary rounded-lg ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <p className="font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled || saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-christmas-green' : 'bg-gray-600'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
        {saving && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
          </span>
        )}
      </button>
    </div>
  );
}

function StatusRow({
  label,
  description,
  configured,
  note,
}: {
  label: string;
  description: string;
  configured: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
      <div>
        <p className="font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-muted">{description}</p>
        {note && <p className="text-xs text-yellow-500 mt-1">{note}</p>}
      </div>
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          configured
            ? 'bg-green-500/20 text-green-400'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}
      >
        {configured ? 'Connected' : 'Pending'}
      </span>
    </div>
  );
}
