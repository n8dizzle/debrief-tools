"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface ChildOverview {
  id: string;
  name: string;
  status: string;
  positions: Array<{
    subject: { name: string; slug: string; color: string };
    current_booklet: {
      name: string;
      series: { name: string; level: { name: string } };
    };
  }>;
  recentSessions: Array<{
    session_date: string;
    mistakes: number;
    passed: boolean;
  }>;
}

export default function ParentDashboard() {
  const { data: session } = useSession();
  const [children, setChildren] = useState<ChildOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/children")
      .then((r) => r.json())
      .then((data) => {
        setChildren(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-secondary)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-secondary)" }}>
      {/* Header */}
      <header style={{ background: "var(--sidebar-bg)" }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--gideon-red) 0%, var(--gideon-orange) 100%)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <span
              className="text-lg text-white"
              style={{ fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
            >
              GideonTrack
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "var(--sidebar-text)" }}>{session?.user?.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm font-semibold"
              style={{ color: "var(--gideon-blue)" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-fade-up">
          <h1
            className="text-2xl mb-2"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
          >
            Welcome, {session?.user?.name?.split(" ")[0]}!
          </h1>
          <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
            Track your {children.length === 1 ? "child's" : "children's"} learning progress
          </p>
        </div>

        {children.length === 0 ? (
          <div className="card text-center py-12 animate-fade-up stagger-2">
            <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No students linked yet</p>
            <p style={{ color: "var(--text-secondary)" }}>Please contact the center to link your children to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children.map((child, i) => (
              <Link
                key={child.id}
                href={`/parent/children/${child.id}`}
                className={`card card-interactive block animate-fade-up stagger-${i + 2}`}
              >
                <h2
                  className="text-xl mb-3"
                  style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 }}
                >
                  {child.name}
                </h2>

                {child.positions.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not started yet</p>
                ) : (
                  <div className="space-y-3">
                    {child.positions.map((pos, j) => (
                      <div
                        key={j}
                        className="p-3 rounded-xl"
                        style={{
                          background: pos.subject?.slug === "reading" ? "var(--reading-color-light)" : "var(--math-color-light)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: pos.subject?.slug === "reading" ? "var(--reading-color)" : "var(--math-color)" }}
                          />
                          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {pos.subject?.name}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {pos.current_booklet?.series?.level?.name} &rsaquo; {pos.current_booklet?.series?.name} &rsaquo; Booklet {pos.current_booklet?.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {child.recentSessions.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Last session: {new Date(child.recentSessions[0].session_date + "T00:00:00").toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="mt-3 text-sm font-semibold inline-flex items-center gap-1" style={{ color: "var(--gideon-blue)" }}>
                  View Progress
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
