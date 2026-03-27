"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface CallLog {
  id: string;
  call_id: string;
  call_type: "web_call" | "phone_call";
  direction: string;
  to_number: string | null;
  status: string;
  duration_ms: number | null;
  transcript: string | null;
  call_analysis: any | null;
  created_at: string;
  ended_at: string | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [stats, setStats] = useState({
    totalCalls: 0,
    webCalls: 0,
    phoneCalls: 0,
    avgDuration: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch("/api/calls?limit=5");
      if (res.ok) {
        const data = await res.json();
        setRecentCalls(data.calls || []);
        setStats(data.stats || stats);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number | null) {
    if (!ms) return "--";
    const seconds = Math.round(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          AR Outbound Dashboard
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          AI-powered outbound calling for accounts receivable
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/web-call" className="card flex items-center gap-4 hover:border-[var(--christmas-green-dark)] transition-colors" style={{ textDecoration: "none" }}>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(93, 138, 102, 0.15)" }}>
            <svg className="w-6 h-6" fill="none" stroke="var(--christmas-green-light)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--christmas-cream)" }}>Test Web Call</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Talk to the AI agent in your browser</p>
          </div>
        </Link>

        <Link href="/outbound" className="card flex items-center gap-4 hover:border-[var(--christmas-green-dark)] transition-colors" style={{ textDecoration: "none" }}>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "rgba(184, 149, 107, 0.15)" }}>
            <svg className="w-6 h-6" fill="none" stroke="var(--christmas-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--christmas-cream)" }}>Make Outbound Call</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Call a customer via phone</p>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Calls", value: stats.totalCalls },
          { label: "Web Calls", value: stats.webCalls },
          { label: "Phone Calls", value: stats.phoneCalls },
          { label: "Avg Duration", value: formatDuration(stats.avgDuration) },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
              {loading ? "--" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Calls */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: "var(--christmas-cream)" }}>
            Recent Calls
          </h2>
          <Link href="/history" className="text-sm" style={{ color: "var(--christmas-green-light)" }}>
            View all
          </Link>
        </div>

        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</p>
        ) : recentCalls.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No calls yet. Start with a web call to test the agent.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "var(--bg-card-hover)" }}
              >
                <div className="flex items-center gap-3">
                  <div className={`badge ${call.status === "ended" ? "badge-ended" : call.status === "error" ? "badge-error" : "badge-active"}`}>
                    {call.call_type === "web_call" ? "Web" : "Phone"}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {call.to_number || "Web Call"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatTime(call.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {formatDuration(call.duration_ms)}
                  </p>
                  <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                    {call.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
