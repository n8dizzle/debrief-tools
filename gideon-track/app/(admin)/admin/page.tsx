"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalStudents: number;
  activeStudents: number;
  totalTutors: number;
  totalParents: number;
  recentSessions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, tutorsRes, parentsRes, sessionsRes] = await Promise.all([
          fetch("/api/students"),
          fetch("/api/users?role=tutor"),
          fetch("/api/users?role=parent"),
          fetch("/api/sessions?limit=100"),
        ]);

        const students = await studentsRes.json();
        const tutors = await tutorsRes.json();
        const parents = await parentsRes.json();
        const sessions = await sessionsRes.json();

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().split("T")[0];
        const recentSessions = Array.isArray(sessions)
          ? sessions.filter((s: { session_date: string }) => s.session_date >= weekStr).length
          : 0;

        setStats({
          totalStudents: Array.isArray(students) ? students.length : 0,
          activeStudents: Array.isArray(students)
            ? students.filter((s: { status: string }) => s.status === "active").length
            : 0,
          totalTutors: Array.isArray(tutors) ? tutors.length : 0,
          totalParents: Array.isArray(parents) ? parents.length : 0,
          recentSessions,
        });
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Active Students",
      value: stats?.activeStudents ?? 0,
      sub: `${stats?.totalStudents ?? 0} total enrolled`,
      href: "/admin/students",
      accent: "stat-card-blue",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gideon-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Users",
      value: (stats?.totalTutors ?? 0) + (stats?.totalParents ?? 0),
      sub: `${stats?.totalTutors ?? 0} Tutors, ${stats?.totalParents ?? 0} Parents`,
      href: "/admin/users",
      accent: "stat-card-green",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Sessions (7 days)",
      value: stats?.recentSessions ?? 0,
      accent: "stat-card-red",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gideon-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1
          className="text-2xl"
          style={{
            color: "var(--text-primary)",
            fontFamily: 'var(--font-display), sans-serif',
            fontWeight: 800,
          }}
        >
          Admin Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Overview of your tutoring center
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card, i) => (
          <div key={card.label} className={`card stat-card ${card.accent} animate-fade-up stagger-${i + 1}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {card.label}
              </p>
              {card.icon}
            </div>
            <p
              className="text-3xl mb-1"
              style={{
                color: "var(--text-primary)",
                fontFamily: 'var(--font-display), sans-serif',
                fontWeight: 800,
              }}
            >
              {card.value}
            </p>
            {card.sub && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {card.sub}
              </p>
            )}
            {card.href && (
              <Link
                href={card.href}
                className="text-xs font-semibold mt-3 inline-flex items-center gap-1"
                style={{ color: "var(--gideon-blue)" }}
              >
                Manage
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card animate-fade-up stagger-5">
        <h2
          className="text-lg mb-4"
          style={{
            color: "var(--text-primary)",
            fontFamily: 'var(--font-display), sans-serif',
            fontWeight: 700,
          }}
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin/students" className="btn btn-primary text-center py-2.5">
            Add Student
          </Link>
          <Link href="/admin/curriculum" className="btn btn-secondary text-center py-2.5">
            Manage Curriculum
          </Link>
          <Link href="/admin/sessions/new" className="btn btn-blue text-center py-2.5">
            Log a Session
          </Link>
        </div>
      </div>
    </div>
  );
}
