"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

interface Stats {
  clicks: { last7Days: number; last30Days: number };
  topTools: { id: string; name: string; count: number }[];
  activeUsers: { last7Days: number };
  usersByDepartment: { id: string; name: string; count: number }[];
  totals: { users: number; tools: number };
}

export default function AdminDashboard() {
  const { user, isOwner } = usePermissions();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Admin Dashboard
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Welcome back, {user?.name?.split(" ")[0] || "Admin"}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading stats...</p>
      ) : stats ? (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Users"
              value={stats.totals.users}
              icon="users"
              href="/admin/users"
            />
            <StatCard
              title="Active Tools"
              value={stats.totals.tools}
              icon="tools"
              href={isOwner ? "/admin/tools" : undefined}
            />
            <StatCard
              title="Tool Clicks (7d)"
              value={stats.clicks.last7Days}
              icon="click"
            />
            <StatCard
              title="Active Users (7d)"
              value={stats.activeUsers.last7Days}
              icon="activity"
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/users/new"
                className="inline-flex items-center px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)'
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add User
              </Link>
              {isOwner && (
                <Link
                  href="/admin/tools/new"
                  className="inline-flex items-center px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Tool
                </Link>
              )}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Tools */}
            <div
              className="rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Top Tools (30 days)
              </h2>
              {stats.topTools.length > 0 ? (
                <div className="space-y-3">
                  {stats.topTools.map((tool, index) => (
                    <div key={tool.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3"
                          style={{
                            background: index === 0 ? 'var(--christmas-gold)' : 'var(--bg-card-hover)',
                            color: index === 0 ? 'var(--dark-bg)' : 'var(--text-secondary)'
                          }}
                        >
                          {index + 1}
                        </span>
                        <span style={{ color: 'var(--christmas-cream)' }}>{tool.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>{tool.count} clicks</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No usage data yet</p>
              )}
            </div>

            {/* Users by Department */}
            <div
              className="rounded-xl p-6"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Users by Department
              </h2>
              {stats.usersByDepartment.length > 0 ? (
                <div className="space-y-3">
                  {stats.usersByDepartment.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between">
                      <span style={{ color: 'var(--christmas-cream)' }}>{dept.name}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-sm"
                        style={{
                          background: 'var(--bg-card-hover)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {dept.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No users yet</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Failed to load stats</p>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: number;
  icon: string;
  href?: string;
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

  const content = (
    <div
      className="rounded-xl p-5 transition-all"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: 'var(--christmas-green)' }}>{icons[icon]}</span>
        {href && (
          <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
        {value}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
