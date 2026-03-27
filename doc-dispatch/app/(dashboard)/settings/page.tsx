'use client';

import { useState, useEffect } from 'react';
import { useDocDispatchPermissions } from '@/hooks/useDocDispatchPermissions';

interface UploadNotificationSettings {
  enabled: boolean;
  recipients: string[];
}

export default function SettingsPage() {
  const { canManageSettings, user } = useDocDispatchPermissions();
  const [notifSettings, setNotifSettings] = useState<UploadNotificationSettings>({ enabled: true, recipients: [] });
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (canManageSettings) {
      fetch('/api/settings')
        .then(r => r.json())
        .then(data => {
          if (data.upload_notifications) {
            setNotifSettings(data.upload_notifications);
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [canManageSettings]);

  if (!canManageSettings) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-muted)' }}>You don't have permission to access settings.</p>
      </div>
    );
  }

  const saveNotifSettings = async (updated: UploadNotificationSettings) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'upload_notifications', value: updated }),
      });
      if (res.ok) {
        setNotifSettings(updated);
        setSaveMessage('Saved');
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch {
      setSaveMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => {
    saveNotifSettings({ ...notifSettings, enabled: !notifSettings.enabled });
  };

  const addRecipient = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || notifSettings.recipients.includes(email)) return;
    saveNotifSettings({ ...notifSettings, recipients: [...notifSettings.recipients, email] });
    setNewEmail('');
  };

  const removeRecipient = (email: string) => {
    saveNotifSettings({ ...notifSettings, recipients: notifSettings.recipients.filter(e => e !== email) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>Settings</h1>

      {/* Upload Notifications */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Upload Notifications</h2>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className="text-xs" style={{ color: saveMessage === 'Saved' ? 'var(--christmas-green-light)' : 'var(--status-error)' }}>
                {saveMessage}
              </span>
            )}
            {loaded && (
              <button
                onClick={toggleEnabled}
                disabled={saving}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: notifSettings.enabled ? 'var(--christmas-green)' : 'var(--bg-secondary)' }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: notifSettings.enabled ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Send an email notification when a new document is uploaded or emailed in.
        </p>

        {loaded && (
          <div style={{ opacity: notifSettings.enabled ? 1 : 0.5, pointerEvents: notifSettings.enabled ? 'auto' : 'none' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-muted)' }}>Recipients</label>

            {/* Recipient list */}
            {notifSettings.recipients.length > 0 && (
              <div className="space-y-1 mb-3">
                {notifSettings.recipients.map(email => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{email}</span>
                    <button
                      onClick={() => removeRecipient(email)}
                      disabled={saving}
                      className="text-xs px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                      style={{ color: 'var(--status-error)' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {notifSettings.recipients.length === 0 && (
              <p className="text-sm mb-3 py-2" style={{ color: 'var(--text-muted)' }}>No recipients added yet.</p>
            )}

            {/* Add recipient */}
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="email@example.com"
                className="input flex-1"
              />
              <button
                onClick={addRecipient}
                disabled={saving || !newEmail.trim()}
                className="btn btn-primary text-sm"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>About Doc Dispatch</h2>
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>Doc Dispatch uses AI to scan and analyze documents for Christmas Air.</p>
          <p>Upload photos of invoices, permits, contracts, and other documents to get automatic extraction of key details and suggested action items.</p>
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>AI Model</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>Currently using <strong>Claude Haiku 4.5</strong> for document analysis.</p>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>~$0.002 per document analyzed</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>User Management</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          User accounts and permissions are managed centrally through the Internal Portal.
        </p>
        <a
          href="https://portal.christmasair.com/admin/users"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary text-sm"
        >
          Manage Users in Portal
        </a>
      </div>
    </div>
  );
}
