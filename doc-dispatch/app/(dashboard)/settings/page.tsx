'use client';

import { useDocDispatchPermissions } from '@/hooks/useDocDispatchPermissions';

export default function SettingsPage() {
  const { canManageSettings, user } = useDocDispatchPermissions();

  if (!canManageSettings) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-muted)' }}>You don't have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>Settings</h1>

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
