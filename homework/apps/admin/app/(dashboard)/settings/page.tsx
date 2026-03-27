'use client';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Settings</h1>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1">
          Platform configuration and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar nav */}
        <div className="admin-card lg:col-span-1 h-fit">
          <nav className="space-y-0.5">
            {[
              { label: 'General', active: true },
              { label: 'Pricing & Fees', active: false },
              { label: 'Notifications', active: false },
              { label: 'Integrations', active: false },
              { label: 'Team', active: false },
              { label: 'Billing', active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'text-primary bg-primary/8'
                    : 'text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-hover)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="admin-card space-y-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">General</h2>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                Platform Name
              </label>
              <input type="text" defaultValue="Homework" className="admin-input max-w-md" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                Support Email
              </label>
              <input type="email" defaultValue="support@homework.com" className="admin-input max-w-md" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                Default Timezone
              </label>
              <select defaultValue="America/Chicago" className="admin-select max-w-md">
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
          </div>

          <div className="admin-card space-y-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Platform Fees</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Homeowner Service Fee
                </label>
                <input type="text" defaultValue="5%" className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Contractor Commission
                </label>
                <input type="text" defaultValue="15%" className="admin-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                Minimum Order Value
              </label>
              <input type="text" defaultValue="$25.00" className="admin-input max-w-xs" />
            </div>
          </div>

          <div className="admin-card space-y-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Feature Flags</h2>
            <div className="space-y-3">
              {[
                { label: 'Enable HomeFit auto-pricing', description: 'Automatically adjust prices based on property data', enabled: true },
                { label: 'Contractor self-service portal', description: 'Allow contractors to manage their own profiles', enabled: true },
                { label: 'Subscription services', description: 'Enable recurring service subscriptions', enabled: false },
                { label: 'Customer referral program', description: 'Reward customers for referring friends', enabled: false },
                { label: 'AI scope verification', description: 'Use AI to verify completed work from photos', enabled: false },
              ].map((flag) => (
                <div key={flag.label} className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
                  <div>
                    <p className="text-sm text-[var(--admin-text)]">{flag.label}</p>
                    <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{flag.description}</p>
                  </div>
                  <button
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      flag.enabled ? 'bg-primary' : 'bg-[var(--admin-border)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        flag.enabled ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}
