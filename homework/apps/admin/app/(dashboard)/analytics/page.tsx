'use client';

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Analytics</h1>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1">
          Platform performance and business metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Monthly GMV</p>
          <p className="stat-value">$482K</p>
          <p className="stat-change text-green-400">+18.3% vs last month</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg Order Value</p>
          <p className="stat-value">$287</p>
          <p className="stat-change text-green-400">+$12 vs last month</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Conversion Rate</p>
          <p className="stat-value">4.2%</p>
          <p className="stat-change text-red-400">-0.3% vs last month</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Customer NPS</p>
          <p className="stat-value">72</p>
          <p className="stat-change text-green-400">+5 vs last month</p>
        </div>
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="admin-card">
          <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
            Revenue Trend
          </h2>
          <div className="h-64 flex items-center justify-center rounded-lg bg-[var(--admin-surface)] border border-dashed border-[var(--admin-border)]">
            <div className="text-center">
              <svg className="w-10 h-10 text-[var(--admin-text-muted)] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-sm text-[var(--admin-text-muted)]">Revenue chart coming soon</p>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
            Orders by Department
          </h2>
          <div className="h-64 flex items-center justify-center rounded-lg bg-[var(--admin-surface)] border border-dashed border-[var(--admin-border)]">
            <div className="text-center">
              <svg className="w-10 h-10 text-[var(--admin-text-muted)] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
              <p className="text-sm text-[var(--admin-text-muted)]">Department breakdown coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Services Table */}
      <div className="admin-card">
        <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
          Top Services (This Month)
        </h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Service</th>
              <th>Department</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Avg Rating</th>
            </tr>
          </thead>
          <tbody>
            {[
              { rank: 1, name: 'Lawn Mowing + Edging', dept: 'The Lot', orders: 156, revenue: '$10,140', rating: 4.8 },
              { rank: 2, name: 'Deep House Cleaning', dept: 'The Interior', orders: 134, revenue: '$42,880', rating: 4.7 },
              { rank: 3, name: 'Pressure Washing - Driveway', dept: 'The Exterior', orders: 98, revenue: '$22,050', rating: 4.9 },
              { rank: 4, name: 'Gutter Cleaning', dept: 'The Exterior', orders: 87, revenue: '$15,225', rating: 4.6 },
              { rank: 5, name: 'Basic Lawn Mowing', dept: 'The Lot', orders: 82, revenue: '$3,690', rating: 4.8 },
              { rank: 6, name: 'Window Cleaning (Exterior)', dept: 'The Exterior', orders: 76, revenue: '$15,960', rating: 4.5 },
              { rank: 7, name: 'Interior Painting - Room', dept: 'The Interior', orders: 63, revenue: '$28,350', rating: 4.4 },
              { rank: 8, name: 'Leaf Cleanup', dept: 'The Lot', orders: 58, revenue: '$5,510', rating: 4.7 },
            ].map((svc) => (
              <tr key={svc.rank}>
                <td className="text-[var(--admin-text-muted)]">{svc.rank}</td>
                <td className="font-medium text-[var(--admin-text)]">{svc.name}</td>
                <td>
                  <span className={`badge ${
                    svc.dept === 'The Lot' ? 'badge-green' :
                    svc.dept === 'The Exterior' ? 'badge-blue' : 'badge-purple'
                  }`}>
                    {svc.dept}
                  </span>
                </td>
                <td>{svc.orders}</td>
                <td className="font-medium text-[var(--admin-text)]">{svc.revenue}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {svc.rating}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Market Performance */}
      <div className="admin-card">
        <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
          Market Performance
        </h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Orders</th>
              <th>GMV</th>
              <th>Contractors</th>
              <th>Avg Rating</th>
              <th>Repeat Rate</th>
            </tr>
          </thead>
          <tbody>
            {[
              { market: 'Austin', orders: 856, gmv: '$312K', contractors: 28, rating: 4.7, repeat: '34%' },
              { market: 'Round Rock', orders: 218, gmv: '$89K', contractors: 14, rating: 4.8, repeat: '31%' },
              { market: 'Cedar Park', orders: 134, gmv: '$52K', contractors: 9, rating: 4.6, repeat: '28%' },
              { market: 'Pflugerville', orders: 76, gmv: '$29K', contractors: 7, rating: 4.5, repeat: '22%' },
            ].map((m) => (
              <tr key={m.market}>
                <td className="font-medium text-[var(--admin-text)]">{m.market}</td>
                <td>{m.orders}</td>
                <td className="font-medium text-[var(--admin-text)]">{m.gmv}</td>
                <td>{m.contractors}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {m.rating}
                  </div>
                </td>
                <td>{m.repeat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
