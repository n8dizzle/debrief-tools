"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/utils";

interface BookletSession {
  id: string;
  rep_number: number;
  mistakes: number;
  passed: boolean;
  session_date: string;
}

interface CurriculumBooklet {
  id: string;
  name: string;
  passing_threshold_override: number | null;
  status: "passed" | "in_progress" | "upcoming";
  is_current: boolean;
  total_reps: number;
  best_score: number | null;
  date_pulled: string | null;
  date_passed: string | null;
  sessions: BookletSession[];
}

interface CurriculumSeries {
  id: string;
  name: string;
  passing_threshold_override: number | null;
  booklets: CurriculumBooklet[];
}

interface CurriculumLevel {
  id: string;
  name: string;
  passing_threshold: number;
  series: CurriculumSeries[];
}

interface Props {
  levels: CurriculumLevel[];
  totalBooklets: number;
  completedBooklets: number;
  subjectColor: string;
  subjectLightColor: string;
}

export default function CurriculumRoadmap({
  levels,
  totalBooklets,
  completedBooklets,
  subjectColor,
  subjectLightColor,
}: Props) {
  const [expandedBooklet, setExpandedBooklet] = useState<string | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const scrolledRef = useRef(false);

  // Auto-scroll to current booklet on mount
  useEffect(() => {
    if (currentRef.current && !scrolledRef.current) {
      scrolledRef.current = true;
      setTimeout(() => {
        currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [levels]);

  const pct = totalBooklets > 0 ? Math.round((completedBooklets / totalBooklets) * 100) : 0;

  return (
    <div className="card animate-fade-up stagger-2">
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2
            className="text-lg"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif", fontWeight: 700 }}
          >
            Curriculum Roadmap
          </h2>
          <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            {completedBooklets} of {totalBooklets} booklets completed
          </span>
        </div>
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: "var(--border-subtle)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "var(--success)" }}
          />
        </div>
      </div>

      {/* Levels */}
      {levels.map((level) => (
        <div key={level.id} className="mb-5 last:mb-0">
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {level.name}
          </h3>

          {level.series.map((series) => (
            <div key={series.id} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {series.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {series.booklets.map((booklet) => {
                  const isExpanded = expandedBooklet === booklet.id;

                  return (
                    <div key={booklet.id} className="contents">
                      <button
                        ref={booklet.is_current ? currentRef : undefined}
                        onClick={() => setExpandedBooklet(isExpanded ? null : booklet.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={getChipStyle(booklet, subjectColor, subjectLightColor, isExpanded)}
                      >
                        {booklet.status === "passed" && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {booklet.is_current && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background: "currentColor",
                              animation: "pulse 2s ease-in-out infinite",
                            }}
                          />
                        )}
                        {booklet.name}
                        {booklet.status === "passed" && booklet.total_reps > 0 && (
                          <span style={{ opacity: 0.7 }}>({booklet.total_reps})</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Expanded booklet detail (rendered below the chip row) */}
              {series.booklets.map((booklet) => {
                if (expandedBooklet !== booklet.id) return null;

                return (
                  <BookletDetail
                    key={`detail-${booklet.id}`}
                    booklet={booklet}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function getChipStyle(
  booklet: CurriculumBooklet,
  subjectColor: string,
  subjectLightColor: string,
  isExpanded: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = { cursor: "pointer" };

  if (booklet.status === "passed") {
    return {
      ...base,
      background: isExpanded ? "#2E7D4F" : "rgba(46, 125, 79, 0.12)",
      color: isExpanded ? "white" : "#2E7D4F",
      border: `1.5px solid ${isExpanded ? "#2E7D4F" : "rgba(46, 125, 79, 0.25)"}`,
    };
  }

  if (booklet.is_current) {
    return {
      ...base,
      background: isExpanded ? subjectColor : subjectLightColor,
      color: isExpanded ? "white" : subjectColor,
      border: `2px solid ${subjectColor}`,
      boxShadow: `0 0 0 3px ${subjectColor}22`,
    };
  }

  if (booklet.status === "in_progress") {
    return {
      ...base,
      background: subjectLightColor,
      color: subjectColor,
      border: `1.5px solid ${subjectColor}44`,
    };
  }

  // upcoming
  return {
    ...base,
    background: "var(--bg-secondary)",
    color: "var(--text-muted)",
    border: "1.5px solid var(--border-subtle)",
  };
}

function BookletDetail({
  booklet,
}: {
  booklet: CurriculumBooklet;
}) {
  const hasSessions = booklet.sessions.length > 0;

  return (
    <div
      className="mt-2 mb-3 p-4 rounded-xl animate-fade-in"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}
    >
      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 mb-3">
        <StatusBadge status={booklet.status} isCurrent={booklet.is_current} />
        {booklet.total_reps > 0 && (
          <Stat label="Total Reps" value={booklet.total_reps} />
        )}
        {booklet.best_score !== null && (
          <Stat label="Best Score" value={`${booklet.best_score} mistakes`} />
        )}
        {booklet.date_pulled && (
          <Stat label="Started" value={formatDate(booklet.date_pulled)} />
        )}
        {booklet.date_passed && (
          <Stat label="Passed" value={formatDate(booklet.date_passed)} />
        )}
      </div>

      {/* Session history table */}
      {hasSessions && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
            Session History
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th className="text-left py-1.5 pr-3 font-semibold">Date</th>
                  <th className="text-left py-1.5 pr-3 font-semibold">Rep</th>
                  <th className="text-left py-1.5 pr-3 font-semibold">Mistakes</th>
                  <th className="text-left py-1.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {booklet.sessions.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="py-1.5 pr-3" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(s.session_date)}
                    </td>
                    <td className="py-1.5 pr-3" style={{ color: "var(--text-primary)" }}>
                      #{s.rep_number}
                    </td>
                    <td
                      className="py-1.5 pr-3"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-display), sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {s.mistakes}
                    </td>
                    <td className="py-1.5">
                      <span className={`badge badge-${s.passed ? "success" : "warning"}`}>
                        {s.passed ? "Passed" : "Practice"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasSessions && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No sessions recorded yet
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  if (isCurrent) return <span className="badge badge-reading">Current</span>;
  if (status === "passed") return <span className="badge badge-success">Passed</span>;
  if (status === "in_progress") return <span className="badge badge-warning">In Progress</span>;
  return <span className="badge">Upcoming</span>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
