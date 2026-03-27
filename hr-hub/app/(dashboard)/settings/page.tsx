'use client';

import { useState } from 'react';
import { useHRPermissions } from '@/hooks/useHRPermissions';

export default function SettingsPage() {
  const { canManageTemplates, isOwner } = useHRPermissions();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSeedMsg(data.message || 'Base template seeded successfully!');
      } else {
        setSeedMsg(data.error || 'Failed to seed template');
      }
    } catch (err) {
      setSeedMsg('Error seeding template');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        HR Hub Settings
      </h1>

      {/* App Info */}
      <div className="card mb-6">
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
          About HR Hub
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>App</span>
            <span style={{ color: 'var(--text-primary)' }}>HR Hub</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Purpose</span>
            <span style={{ color: 'var(--text-primary)' }}>Employee Onboarding Management</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>URL</span>
            <span style={{ color: 'var(--text-primary)' }}>hr.christmasair.com</span>
          </div>
        </div>
      </div>

      {/* Seed Template */}
      {isOwner && (
        <div className="card">
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
            Template Management
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Seed the base onboarding workflow template with default phases and steps.
            This will create a comprehensive template that can be used as the foundation for all onboardings.
          </p>

          <button
            className="btn btn-primary"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? 'Seeding...' : 'Seed Base Template'}
          </button>

          {seedMsg && (
            <div
              className="mt-3 rounded-lg p-3 text-sm"
              style={{
                backgroundColor: seedMsg.toLowerCase().includes('success') || seedMsg.toLowerCase().includes('created')
                  ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: seedMsg.toLowerCase().includes('success') || seedMsg.toLowerCase().includes('created')
                  ? '#4ade80' : '#f87171',
              }}
            >
              {seedMsg}
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            Settings are only available to owners.
          </p>
        </div>
      )}
    </div>
  );
}
