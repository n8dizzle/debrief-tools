"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Student, Subject, CurriculumLevel, Series, Booklet, StudentPosition } from "@/lib/supabase";

interface SessionResult {
  passed: boolean;
  threshold: number;
  mistakes: number;
  nextBooklet: Booklet | null;
}

export default function SessionForm() {
  const { data: session } = useSession();

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [allBooklets, setAllBooklets] = useState<Booklet[]>([]);
  const [positions, setPositions] = useState<StudentPosition[]>([]);
  const [lastRep, setLastRep] = useState<number>(0);

  // Form
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookletId, setBookletId] = useState("");
  const [mistakes, setMistakes] = useState(0);
  const [repNumber, setRepNumber] = useState(1);
  const [notes, setNotes] = useState("");

  // UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setStudentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [session?.user?.id]);

  async function loadInitialData() {
    if (!session?.user?.id) return;
    setLoading(true);
    const isAdmin = session.user.role === "admin";
    const studentUrl = isAdmin
      ? "/api/students?status=active"
      : `/api/students?status=active&tutorId=${session.user.id}`;

    const [studRes, levelsRes, seriesRes, bookletsRes] = await Promise.all([
      fetch(studentUrl),
      fetch("/api/curriculum/levels"),
      fetch("/api/curriculum/series"),
      fetch("/api/curriculum/booklets"),
    ]);

    const studData = await studRes.json();
    const levelsData = await levelsRes.json();
    const seriesData = await seriesRes.json();
    const bookletsData = await bookletsRes.json();

    setStudents(studData);
    setLevels(levelsData);
    setAllSeries(seriesData);
    setAllBooklets(bookletsData);

    // Extract subjects
    const subjectMap = new Map<string, Subject>();
    levelsData.forEach((l: CurriculumLevel & { subject: Subject }) => {
      if (l.subject) subjectMap.set(l.subject.id, l.subject);
    });
    setSubjects(Array.from(subjectMap.values()).sort((a, b) => a.sort_order - b.sort_order));

    setLoading(false);
  }

  // When student changes, load their positions
  useEffect(() => {
    if (!studentId) {
      setPositions([]);
      return;
    }
    fetch(`/api/students/${studentId}/positions`)
      .then((r) => r.json())
      .then((data) => {
        setPositions(Array.isArray(data) ? data : []);
      });
  }, [studentId]);

  // When subject changes, auto-set booklet from position
  useEffect(() => {
    if (!subjectId || !positions.length) return;
    const pos = positions.find((p) => p.subject_id === subjectId);
    if (pos) {
      setBookletId(pos.current_booklet_id);
      // Load last rep for this booklet
      loadLastRep(studentId, pos.current_booklet_id);
    } else {
      setBookletId("");
      setLastRep(0);
      setRepNumber(1);
    }
  }, [subjectId, positions]);

  async function loadLastRep(studId: string, bkId: string) {
    const res = await fetch(`/api/sessions?studentId=${studId}&bookletId=${bkId}&limit=1`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      setLastRep(data[0].rep_number);
      setRepNumber(data[0].rep_number + 1);
    } else {
      setLastRep(0);
      setRepNumber(1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        booklet_id: bookletId,
        mistakes,
        rep_number: repNumber,
        notes: notes || null,
        auto_advance: true,
      }),
    });

    const data = await res.json();
    setResult({
      passed: data.passed,
      threshold: data.threshold,
      mistakes,
      nextBooklet: data.nextBooklet,
    });

    // Reset for next entry
    setMistakes(0);
    setNotes("");

    if (data.passed && data.nextBooklet) {
      setBookletId(data.nextBooklet.id);
      setRepNumber(1);
      setLastRep(0);
    } else {
      setRepNumber(repNumber + 1);
      setLastRep(repNumber);
    }

    setSubmitting(false);
  }

  // Get current booklet info for display
  const currentBooklet = allBooklets.find((b) => b.id === bookletId);
  const currentSeries = currentBooklet ? allSeries.find((s) => s.id === currentBooklet.series_id) : null;
  const currentLevel = currentSeries ? levels.find((l) => l.id === currentSeries.level_id) : null;

  const threshold = currentBooklet?.passing_threshold_override
    ?? currentSeries?.passing_threshold_override
    ?? currentLevel?.passing_threshold
    ?? 3;

  // For manual booklet selection
  const filteredLevels = levels.filter((l) => l.subject_id === subjectId);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p style={{ color: "var(--text-secondary)" }}>Loading...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="text-2xl" style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}>Log Session</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Record a tutoring session</p>
      </div>

      {/* Result Banner */}
      {result && (
        <div
          className="p-4 rounded-lg mb-6 flex items-center gap-3"
          style={{
            background: result.passed ? "var(--success-light)" : "var(--bg-secondary)",
            border: `1px solid ${result.passed ? "var(--success)" : "var(--border-default)"}`,
          }}
        >
          <span className="text-2xl">{result.passed ? "\u{1F389}" : "\u{1F4DD}"}</span>
          <div>
            {result.passed ? (
              <>
                <p className="font-semibold" style={{ color: "#065F46" }}>
                  Passed! ({result.mistakes} mistake{result.mistakes !== 1 ? "s" : ""} / {result.threshold} threshold)
                </p>
                {result.nextBooklet ? (
                  <p className="text-sm" style={{ color: "#065F46" }}>
                    Advanced to Booklet {result.nextBooklet.name}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "#065F46" }}>
                    Completed all booklets in this subject!
                  </p>
                )}
              </>
            ) : (
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                Not yet ({result.mistakes} mistake{result.mistakes !== 1 ? "s" : ""} / {result.threshold} threshold). Keep practicing!
              </p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        {/* Student Selection */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Student</label>
          <div className="relative" ref={studentDropdownRef}>
            <input
              className="input w-full"
              placeholder="Search students..."
              value={studentDropdownOpen ? studentSearch : (students.find((s) => s.id === studentId)?.name || studentSearch)}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setStudentDropdownOpen(true);
              }}
              onFocus={() => {
                setStudentDropdownOpen(true);
                setStudentSearch("");
              }}
              required={!studentId}
            />
            {studentId && !studentDropdownOpen && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--text-muted)" }}
                onClick={() => {
                  setStudentId("");
                  setSubjectId("");
                  setBookletId("");
                  setResult(null);
                  setStudentSearch("");
                  setStudentDropdownOpen(true);
                }}
              >
                Clear
              </button>
            )}
            {studentDropdownOpen && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }}
              >
                {students
                  .filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{
                        color: "var(--text-primary)",
                        background: s.id === studentId ? "var(--bg-secondary)" : "transparent",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = s.id === studentId ? "var(--bg-secondary)" : "transparent")}
                      onClick={() => {
                        setStudentId(s.id);
                        setStudentSearch(s.name);
                        setStudentDropdownOpen(false);
                        setSubjectId("");
                        setBookletId("");
                        setResult(null);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                {students.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                  <p className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>No students found</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subject Selection */}
        {studentId && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Subject</label>
            <div className="flex gap-2">
              {subjects.map((sub) => {
                const hasPosition = positions.some((p) => p.subject_id === sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => { setSubjectId(sub.id); setResult(null); }}
                    className="btn flex-1"
                    style={{
                      background: subjectId === sub.id ? sub.color : "transparent",
                      color: subjectId === sub.id ? "white" : "var(--text-secondary)",
                      border: `1px solid ${subjectId === sub.id ? sub.color : "var(--border-default)"}`,
                    }}
                  >
                    {sub.name}
                    {hasPosition && <span className="ml-1 opacity-60">*</span>}
                  </button>
                );
              })}
            </div>
            {positions.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>* = has current position</p>
            )}
          </div>
        )}

        {/* Current Booklet Display / Manual Selection */}
        {subjectId && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Booklet</label>
            {bookletId && currentBooklet && currentSeries && currentLevel ? (
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {currentLevel.name} &rsaquo; {currentSeries.name} &rsaquo; Booklet {currentBooklet.name}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Pass threshold: {threshold} mistakes | Rep #{repNumber}
                </p>
                <button
                  type="button"
                  className="text-xs mt-1"
                  style={{ color: "var(--gideon-blue)" }}
                  onClick={() => setBookletId("")}
                >
                  Change booklet
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {positions.some((p) => p.subject_id === subjectId)
                    ? "Select a different booklet:"
                    : "No position set. Select a starting booklet:"}
                </p>
                <select
                  className="select"
                  value={bookletId}
                  onChange={(e) => {
                    setBookletId(e.target.value);
                    if (e.target.value) loadLastRep(studentId, e.target.value);
                  }}
                  required
                >
                  <option value="">Choose booklet...</option>
                  {filteredLevels.map((level) => {
                    const levelSeries = allSeries.filter((s) => s.level_id === level.id);
                    return levelSeries.map((series) => {
                      const booklets = allBooklets.filter((b) => b.series_id === series.id);
                      return booklets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {level.name} &gt; {series.name} &gt; {b.name}
                        </option>
                      ));
                    });
                  })}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Mistakes Counter */}
        {bookletId && (
          <>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Mistakes</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMistakes(Math.max(0, mistakes - 1))}
                  className="w-14 h-14 rounded-xl text-2xl font-bold flex items-center justify-center"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    min="0"
                    className="text-5xl font-bold text-center w-full bg-transparent outline-none"
                    style={{
                      color: mistakes <= threshold ? "var(--success)" : "var(--text-primary)",
                    }}
                    value={mistakes}
                    onChange={(e) => setMistakes(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Threshold: {threshold} | {mistakes <= threshold ? "✓ Pass" : "✗ Not yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMistakes(mistakes + 1)}
                  className="w-14 h-14 rounded-xl text-2xl font-bold flex items-center justify-center"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes (optional)</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations..." />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn w-full py-3.5 text-base"
              style={{
                background: mistakes <= threshold ? "var(--success)" : "var(--gideon-red)",
                color: "white",
                fontWeight: 700,
                boxShadow: mistakes <= threshold ? '0 3px 10px rgba(46,125,79,0.3)' : '0 3px 10px rgba(217,48,37,0.3)',
              }}
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : mistakes <= threshold
                ? `Submit & Pass (Rep #${repNumber})`
                : `Submit Rep #${repNumber}`}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
