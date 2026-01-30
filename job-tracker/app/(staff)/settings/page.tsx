import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Configure job tracker settings</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Notification Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Notifications</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
              <div>
                <p className="font-medium text-text-primary">SMS (Twilio)</p>
                <p className="text-text-muted">Send text message notifications</p>
              </div>
              <span className={`badge ${process.env.TWILIO_ACCOUNT_SID ? 'badge-completed' : 'badge-pending'}`}>
                {process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
              <div>
                <p className="font-medium text-text-primary">Email (Resend)</p>
                <p className="text-text-muted">Send email notifications</p>
              </div>
              <span className={`badge ${process.env.RESEND_API_KEY ? 'badge-completed' : 'badge-pending'}`}>
                {process.env.RESEND_API_KEY ? 'Configured' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Integration Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Integrations</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
              <div>
                <p className="font-medium text-text-primary">ServiceTitan</p>
                <p className="text-text-muted">Auto-create trackers for install jobs</p>
              </div>
              <span className={`badge ${process.env.ST_CLIENT_ID ? 'badge-completed' : 'badge-pending'}`}>
                {process.env.ST_CLIENT_ID ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Environment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">App URL</dt>
              <dd className="text-text-secondary font-mono">{process.env.NEXT_PUBLIC_APP_URL || 'Not set'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Environment</dt>
              <dd className="text-text-secondary">{process.env.NODE_ENV}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
