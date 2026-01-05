"use client";

import { useEffect, useState } from "react";

interface Stats {
  clicks: { last7Days: number; last30Days: number };
  topTools: { id: string; name: string; count: number }[];
  activeUsers: { last7Days: number };
  usersByDepartment: { id: string; name: string; count: number }[];
  totals: { users: number; tools: number };
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading stats...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Failed to load stats</p>
      </div>
    );
  }

  const maxClicks = Math.max(...stats.topTools.map((t) => t.count), 1);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Usage Statistics
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Overview of portal usage and engagement
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totals.users}
          icon="users"
        />
        <StatCard
          title="Active Tools"
          value={stats.totals.tools}
          icon="tools"
        />
        <StatCard
          title="Clicks (7 days)"
          value={stats.clicks.last7Days}
          subtitle={`${stats.clicks.last30Days} in 30 days`}
          icon="click"
        />
        <StatCard
          title="Active Users (7 days)"
          value={stats.activeUsers.last7Days}
          icon="activity"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Tools */}
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--christmas-cream)" }}>
            Most Used Tools (30 days)
          </h2>
          {stats.topTools.length > 0 ? (
            <div className="space-y-4">
              {stats.topTools.map((tool, index) => (
                <div key={tool.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--christmas-cream)" }}>
                      {index + 1}. {tool.name}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {tool.count} clicks
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(tool.count / maxClicks) * 100}%`,
                        background: index === 0
                          ? "var(--christmas-gold)"
                          : index === 1
                          ? "var(--christmas-green)"
                          : "var(--christmas-green-dark)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No usage data yet</p>
          )}
        </div>

        {/* Users by Department */}
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--christmas-cream)" }}>
            Users by Department
          </h2>
          {stats.usersByDepartment.length > 0 ? (
            <div className="space-y-3">
              {stats.usersByDepartment.map((dept) => {
                const percentage = stats.totals.users > 0
                  ? Math.round((dept.count / stats.totals.users) * 100)
                  : 0;
                return (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{
                          background: "var(--christmas-green)",
                          color: "var(--christmas-cream)",
                        }}
                      >
                        {dept.count}
                      </div>
                      <span style={{ color: "var(--christmas-cream)" }}>{dept.name}</span>
                    </div>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No users yet</p>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-8 p-4 rounded-lg" style={{ background: "var(--bg-card)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Stats are updated in real-time. Click counts are tracked when users click on tools from the portal homepage.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: string;
}) {
  const icons: Record<string, JSX.Element> = {
    users: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    tools: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    click: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
    activity: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: "var(--christmas-green)" }}>{icons[icon]}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: "var(--christmas-cream)" }}>
        {value}
      </p>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
