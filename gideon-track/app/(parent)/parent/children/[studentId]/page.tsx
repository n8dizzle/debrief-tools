"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import CurriculumRoadmap from "@/components/CurriculumRoadmap";
import SeriesProgressChart from "@/components/SeriesProgressChart";

interface ChildData {
  student: {
    id: string;
    name: string;
    enrollment_date: string;
  };
  positions: Array<{
    id: string;
    subject_id: string;
    subject: { id: string; name: string; slug: string; color: string };
    current_booklet: {
      id: string;
      name: string;
      passing_threshold_override: number | null;
      series: {
        name: string;
        passing_threshold_override: number | null;
        level: { name: string; passing_threshold: number };
      };
    };
  }>;
  sessions: Array<{
    id: string;
    session_date: string;
    booklet_id: string;
    rep_number: number;
    mistakes: number;
    passed: boolean;
    booklet: {
      name: string;
      series: { name: string; level: { name: string; subject: { name: string; slug: string } } };
    };
  }>;
  progress: Array<{
    booklet_id: string;
    status: string;
    total_reps: number;
    best_score: number | null;
    date_pulled: string;
    date_passed: string | null;
    booklet: { name: string; sort_order: number; series: { name: string; sort_order: number; level: { name: string; sort_order: number; subject: { name: string; slug: string } } } };
  }>;
}

export default function ChildProgressPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<ChildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [curriculum, setCurriculum] = useState<any>(null);
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/parent/children/${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.positions?.length > 0) {
          setSelectedSubject(d.positions[0].subject_id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentId]);

  // Fetch curriculum when subject changes
  useEffect(() => {
    if (!selectedSubject || !studentId) return;
    setCurriculumLoading(true);
    setCurriculum(null);
    fetch(`/api/parent/children/${studentId}/curriculum?subjectId=${selectedSubject}`)
      .then((r) => r.json())
      .then((d) => {
        setCurriculum(d);
        setCurriculumLoading(false);
      })
      .catch(() => setCurriculumLoading(false));
  }, [studentId, selectedSubject]);

  if (loading || !data?.student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-secondary)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const currentPosition = data.positions.find((p) => p.subject_id === selectedSubject);
  const threshold = currentPosition
    ? (currentPosition.current_booklet?.passing_threshold_override
      ?? currentPosition.current_booklet?.series?.passing_threshold_override
      ?? currentPosition.current_booklet?.series?.level?.passing_threshold
      ?? 3)
    : 3;

  const currentBookletId = currentPosition?.current_booklet?.id;
  const currentBookletSessions = data.sessions
    .filter((s) => s.booklet_id === currentBookletId)
    .sort((a, b) => a.rep_number - b.rep_number);

  const getMotivation = () => {
    if (currentBookletSessions.length < 2) return null;
    const first = currentBookletSessions[0].mistakes;
    const last = currentBookletSessions[currentBookletSessions.length - 1].mistakes;
    if (last < first) {
      return `${data.student.name} improved from ${first} to ${last} mistakes!`;
    }
    if (last <= threshold) {
      return `Almost there! Just ${last} mistake${last !== 1 ? "s" : ""} away from passing!`;
    }
    return `Keep practicing! Every rep builds mastery.`;
  };

  const motivation = getMotivation();
  const passedCount = curriculum?.completed_booklets ?? data.progress.filter((p) => p.status === "passed").length;

  const selectedSubjectSlug = data.positions.find((p) => p.subject_id === selectedSubject)?.subject?.slug;

  // Map subject colors to our new palette
  const getSubjectColor = (slug: string) => slug === "reading" ? "var(--reading-color)" : "var(--math-color)";
  const getSubjectLightColor = (slug: string) => slug === "reading" ? "var(--reading-color-light)" : "var(--math-color-light)";
  const subjectColor = getSubjectColor(selectedSubjectSlug || "reading");
  const subjectLightColor = getSubjectLightColor(selectedSubjectSlug || "reading");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-secondary)" }}>
      {/* Header */}
      <header style={{ background: "var(--sidebar-bg)" }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/parent")}
              className="text-sm font-semibold inline-flex items-center gap-1"
              style={{ color: "var(--gideon-blue)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            <span className="text-white font-bold">{data.student.name}</span>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm font-semibold" style={{ color: "var(--gideon-blue)" }}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Motivation Banner */}
        {motivation && (
          <div
            className="p-4 rounded-xl mb-6 flex items-center gap-3 animate-scale-in"
            style={{
              background: "var(--gideon-blue-50)",
              border: "1.5px solid var(--gideon-blue-light)",
            }}
          >
            <span className="text-2xl">{"\u2B50"}</span>
            <p className="font-bold text-sm" style={{ color: "var(--gideon-blue-dark)" }}>{motivation}</p>
          </div>
        )}

        {/* Subject Tabs */}
        {data.positions.length > 1 && (
          <div className="flex gap-2 mb-6">
            {data.positions.map((pos) => {
              const isReading = pos.subject.slug === "reading";
              const isSelected = selectedSubject === pos.subject_id;
              return (
                <button
                  key={pos.subject_id}
                  onClick={() => setSelectedSubject(pos.subject_id)}
                  className="btn flex-1"
                  style={{
                    background: isSelected
                      ? getSubjectColor(pos.subject.slug)
                      : getSubjectLightColor(pos.subject.slug),
                    color: isSelected ? "white" : (isReading ? "var(--reading-color-dark)" : "var(--math-color-dark)"),
                    border: `2px solid ${isSelected ? getSubjectColor(pos.subject.slug) : "transparent"}`,
                    boxShadow: isSelected ? `0 2px 8px ${isReading ? 'rgba(41,182,214,0.3)' : 'rgba(232,133,46,0.3)'}` : 'none',
                  }}
                >
                  {pos.subject.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Current Position Card */}
        {currentPosition && (
          <div className="card mb-6 animate-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: getSubjectColor(currentPosition.subject.slug) }} />
              <h2
                className="text-lg"
                style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 }}
              >
                {currentPosition.subject.name} Progress
              </h2>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{
                background: getSubjectLightColor(currentPosition.subject.slug),
                border: `1px solid ${currentPosition.subject.slug === "reading" ? "rgba(41,182,214,0.15)" : "rgba(232,133,46,0.15)"}`,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Currently on</p>
              <p
                className="text-xl"
                style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
              >
                {currentPosition.current_booklet?.series?.level?.name} &rsaquo; {currentPosition.current_booklet?.series?.name} &rsaquo; Booklet {currentPosition.current_booklet?.name}
              </p>
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Booklets Done</p>
                  <p
                    className="text-xl"
                    style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
                  >
                    {passedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Current Rep</p>
                  <p
                    className="text-xl"
                    style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
                  >
                    #{currentBookletSessions.length > 0 ? currentBookletSessions[currentBookletSessions.length - 1].rep_number : 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Pass Threshold</p>
                  <p
                    className="text-xl"
                    style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
                  >
                    {threshold}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Series Progress Chart */}
        {curriculum?.levels && !curriculumLoading && (() => {
          const seriesOptions: { id: string; label: string; levelName: string; seriesName: string; booklets: { id: string; name: string; status: "passed" | "in_progress" | "upcoming"; is_current: boolean; total_reps: number }[] }[] = [];
          let currentSeriesId: string | null = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const level of curriculum.levels) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const series of level.series) {
              const hasActivity = series.booklets.some((b: any) => b.total_reps > 0 || b.is_current);
              if (!hasActivity) continue;
              seriesOptions.push({
                id: series.id,
                label: `${level.name} — ${series.name}`,
                levelName: level.name,
                seriesName: series.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                booklets: series.booklets.map((b: any) => ({
                  id: b.id,
                  name: b.name,
                  status: b.status,
                  is_current: b.is_current,
                  total_reps: b.total_reps,
                })),
              });
              if (series.booklets.some((b: any) => b.is_current)) {
                currentSeriesId = series.id;
              }
            }
          }
          if (seriesOptions.length === 0) return null;
          return (
            <SeriesProgressChart
              seriesOptions={seriesOptions}
              currentSeriesId={currentSeriesId}
              subjectColor={subjectColor}
            />
          );
        })()}

        {/* Curriculum Roadmap */}
        {curriculumLoading && (
          <div className="card mb-6 flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: subjectColor, borderTopColor: 'transparent' }} />
          </div>
        )}
        {curriculum?.levels && !curriculumLoading && (
          <CurriculumRoadmap
            levels={curriculum.levels}
            totalBooklets={curriculum.total_booklets}
            completedBooklets={curriculum.completed_booklets}
            subjectColor={subjectColor}
            subjectLightColor={subjectLightColor}
          />
        )}
      </main>
    </div>
  );
}
