"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Student, StudentPosition, SessionLog } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

export default function TutorStudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [positions, setPositions] = useState<StudentPosition[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [studentId]);

  async function loadData() {
    setLoading(true);
    const [studRes, posRes, sessRes] = await Promise.all([
      fetch(`/api/students/${studentId}`),
      fetch(`/api/students/${studentId}/positions`),
      fetch(`/api/students/${studentId}/sessions?limit=30`),
    ]);
    setStudent(await studRes.json());
    setPositions(await posRes.json());
    setSessions(await sessRes.json());
    setLoading(false);
  }

  if (loading || !student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/tutor")}
        className="text-sm mb-4 inline-flex items-center gap-1 font-semibold"
        style={{ color: "var(--gideon-blue)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl"
          style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
        >
          {student.name}
        </h1>
        <Link href="/tutor/sessions/new" className="btn btn-primary">Log Session</Link>
      </div>

      {/* Current Positions */}
      <div className="card mb-6 animate-fade-up">
        <h2
          className="text-lg mb-3"
          style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 }}
        >
          Current Position
        </h2>
        {positions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Not started yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="p-4 rounded-xl"
                style={{
                  background: pos.subject?.slug === "reading" ? "var(--reading-color-light)" : "var(--math-color-light)",
                  border: `1px solid ${pos.subject?.slug === "reading" ? "rgba(41,182,214,0.15)" : "rgba(232,133,46,0.15)"}`,
                }}
              >
                <span className={`badge badge-${pos.subject?.slug === "reading" ? "reading" : "math"} mb-1`}>
                  {pos.subject?.name}
                </span>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {pos.current_booklet?.series?.level?.name} &rsaquo; {pos.current_booklet?.series?.name} &rsaquo; Booklet {pos.current_booklet?.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="card animate-fade-up stagger-2">
        <h2
          className="text-lg mb-3"
          style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 }}
        >
          Recent Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No sessions logged yet</p>
        ) : (
          <div className="overflow-x-auto" style={{ margin: '-0.25rem' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Booklet</th>
                  <th className="table-header text-center">Rep</th>
                  <th className="table-header text-center">Mistakes</th>
                  <th className="table-header text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any, i: number) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td className="table-cell text-sm" style={{ color: "var(--text-primary)" }}>{formatDate(s.session_date)}</td>
                    <td className="table-cell text-sm" style={{ color: "var(--text-secondary)" }}>
                      {s.booklet?.series?.level?.name} &rsaquo; {s.booklet?.series?.name} &rsaquo; {s.booklet?.name}
                    </td>
                    <td className="table-cell text-sm text-center" style={{ color: "var(--text-secondary)" }}>#{s.rep_number}</td>
                    <td className="table-cell text-sm text-center font-semibold" style={{ color: "var(--text-primary)" }}>{s.mistakes}</td>
                    <td className="table-cell text-center">
                      <span className={`badge badge-${s.passed ? "success" : "warning"}`}>
                        {s.passed ? "Passed" : "Practice"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
