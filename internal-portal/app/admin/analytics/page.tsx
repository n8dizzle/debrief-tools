"use client";

import { useEffect, useState } from "react";

interface AppStat {
  app: string;
  label: string;
  views: number;
  uniqueUsers: number;
}

interface UserStat {
  email: string;
  name: string;
  views: number;
  appsUsed: number;
  apps: string[];
}

interface TopPage {
  app: string;
  label: string;
  pages: { path: string; count: number }[];
}

interface DailyTrend {
  date: string;
  total: number;
  [app: string]: string | number;
}

interface AnalyticsData {
  period: { days: number; since: string };
  summary: { totalViews: number; uniqueUsers: number; totalApps: number };
  appStats: AppStat[];
  userStats: UserStat[];
  topPages: TopPage[];
  dailyTrend: DailyTrend[];
  appLabels: Record<string, string>;
}

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const APP_COLORS: Record<string, string> = {
  daily_dash: "#5D8A66",
  marketing_hub: "#B8956B",
  ar_collections: "#6B9B75",
  job_tracker: "#3b82f6",
  ap_payments: "#eab308",
  membership_manager: "#8b5cf6",
  doc_dispatch: "#ef4444",
  celebrations: "#ec4899",
  internal_portal: "#4A7053",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?days=${days}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Failed to load analytics</p>
      </div>
    );
  }

  const maxAppViews = Math.max(...data.appStats.map((a) => a.views), 1);
  const maxDailyTotal = Math.max(...data.dailyTrend.map((d) => d.total), 1);

  // Filter top pages to selected app or show all
  const filteredTopPages = selectedApp
    ? data.topPages.filter((p) => p.app === selectedApp)
    : data.topPages;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--christmas-cream)" }}
          >
            App Analytics
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Usage tracking across all internal tools
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{
                background:
                  days === opt.value
                    ? "var(--christmas-green)"
                    : "var(--bg-card)",
                color:
                  days === opt.value
                    ? "var(--christmas-cream)"
                    : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          title="Total Page Views"
          value={data.summary.totalViews}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          }
        />
        <SummaryCard
          title="Active Users"
          value={data.summary.uniqueUsers}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
        />
        <SummaryCard
          title="Apps Used"
          value={data.summary.totalApps}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          }
        />
      </div>

      {/* Daily Trend */}
      {data.dailyTrend.length > 0 && (
        <div
          className="rounded-xl p-6 mb-8"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--christmas-cream)" }}
          >
            Daily Page Views
          </h2>
          <div className="flex items-end gap-[2px] h-40">
            {data.dailyTrend.map((day) => {
              const height = (day.total / maxDailyTotal) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 group relative"
                  style={{ minWidth: 0 }}
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      background: "var(--christmas-green)",
                      opacity: 0.8,
                    }}
                  />
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--christmas-cream)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {day.date}: {day.total} views
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {data.dailyTrend[0]?.date}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {data.dailyTrend[data.dailyTrend.length - 1]?.date}
            </span>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Views by App */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-6"
            style={{ color: "var(--christmas-cream)" }}
          >
            Views by App
          </h2>
          {data.appStats.length > 0 ? (
            <div className="space-y-4">
              {data.appStats.map((app) => (
                <button
                  key={app.app}
                  className="w-full text-left"
                  onClick={() =>
                    setSelectedApp(selectedApp === app.app ? null : app.app)
                  }
                >
                  <div className="flex justify-between mb-1">
                    <span
                      className="text-sm font-medium"
                      style={{
                        color:
                          selectedApp === app.app
                            ? APP_COLORS[app.app] || "var(--christmas-green)"
                            : "var(--christmas-cream)",
                      }}
                    >
                      {app.label}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {app.views} views &middot; {app.uniqueUsers} users
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(app.views / maxAppViews) * 100}%`,
                        background:
                          APP_COLORS[app.app] || "var(--christmas-green)",
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No data yet</p>
          )}
        </div>

        {/* Users */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-6"
            style={{ color: "var(--christmas-cream)" }}
          >
            Users
          </h2>
          {data.userStats.length > 0 ? (
            <div className="space-y-3">
              {data.userStats.map((user) => (
                <div
                  key={user.email}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--bg-primary)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: "var(--christmas-green)",
                        color: "var(--christmas-cream)",
                      }}
                    >
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--christmas-cream)" }}
                      >
                        {user.name}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user.apps.join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--christmas-cream)" }}
                    >
                      {user.views}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {user.appsUsed} app{user.appsUsed !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Top Pages */}
      {filteredTopPages.length > 0 && (
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--christmas-cream)" }}
            >
              Top Pages
              {selectedApp && (
                <span
                  className="text-sm font-normal ml-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  (filtered to{" "}
                  {data.appLabels[selectedApp] || selectedApp})
                </span>
              )}
            </h2>
            {selectedApp && (
              <button
                onClick={() => setSelectedApp(null)}
                className="text-xs px-2 py-1 rounded"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--bg-primary)",
                }}
              >
                Show all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopPages.map((appPages) => (
              <div key={appPages.app}>
                <h3
                  className="text-sm font-medium mb-3"
                  style={{
                    color:
                      APP_COLORS[appPages.app] || "var(--christmas-green)",
                  }}
                >
                  {appPages.label}
                </h3>
                <div className="space-y-2">
                  {appPages.pages.map((page) => (
                    <div
                      key={page.path}
                      className="flex items-center justify-between text-sm"
                    >
                      <span
                        className="truncate mr-2"
                        style={{ color: "var(--text-secondary)" }}
                        title={page.path}
                      >
                        {page.path}
                      </span>
                      <span
                        className="flex-shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {page.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      {data.summary.totalViews === 0 && (
        <div
          className="mt-8 p-4 rounded-lg"
          style={{ background: "var(--bg-card)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No analytics data yet. Page views will start appearing as users
            navigate the apps. Each page load is tracked automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: "var(--christmas-green)" }}>{icon}</span>
      </div>
      <p
        className="text-3xl font-bold"
        style={{ color: "var(--christmas-cream)" }}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
    </div>
  );
}
