"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Student, StudentPosition } from "@/lib/supabase";

interface StudentWithPosition extends Student {
  positions: StudentPosition[];
}

export default function TutorDashboard() {
  const { data: session } = useSession();
  const [students, setStudents] = useState<StudentWithPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadStudents();
  }, [session?.user?.id]);

  async function loadStudents() {
    setLoading(true);
    const isAdmin = session?.user?.role === "admin";
    const url = isAdmin
      ? "/api/students?status=active"
      : `/api/students?status=active&tutorId=${session?.user?.id}`;
    const res = await fetch(url);
    const studentList: Student[] = await res.json();

    const enriched = await Promise.all(
      studentList.map(async (s) => {
        const posRes = await fetch(`/api/students/${s.id}/positions`);
        const positions = await posRes.json();
        return { ...s, positions: Array.isArray(positions) ? positions : [] };
      })
    );

    setStudents(enriched);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
          >
            {session?.user?.role === "admin" ? "All Students" : "My Students"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {students.length} active student{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/tutor/sessions/new" className="btn btn-primary">
          Log Session
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No students assigned</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ask an admin to assign students to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student, i) => (
            <Link
              key={student.id}
              href={`/tutor/students/${student.id}`}
              className={`card card-interactive block animate-fade-up stagger-${Math.min(i + 1, 6)}`}
            >
              <h3
                className="font-semibold mb-3 text-base"
                style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif' }}
              >
                {student.name}
              </h3>
              {student.positions.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No position set</p>
              ) : (
                <div className="space-y-2">
                  {student.positions.map((pos) => (
                    <div key={pos.id} className="flex items-center gap-2">
                      <span className={`badge badge-${pos.subject?.slug === "reading" ? "reading" : "math"}`}>
                        {pos.subject?.name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {pos.current_booklet?.series?.level?.name} &rsaquo; {pos.current_booklet?.series?.name} &rsaquo; {pos.current_booklet?.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
