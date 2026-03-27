"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Student, GideonUser, StudentPosition, Subject, CurriculumLevel, Series, Booklet } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

interface TutorLink { id: string; tutor: GideonUser }
interface ParentLink { id: string; parent: GideonUser; relationship: string }

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [tutorLinks, setTutorLinks] = useState<TutorLink[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [positions, setPositions] = useState<StudentPosition[]>([]);
  const [allTutors, setAllTutors] = useState<GideonUser[]>([]);
  const [allParents, setAllParents] = useState<GideonUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", status: "", notes: "" });

  // Add tutor/parent
  const [addingTutor, setAddingTutor] = useState(false);
  const [addingParent, setAddingParent] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [relationship, setRelationship] = useState("Parent");

  // Curriculum data for position assignment
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [allBooklets, setAllBooklets] = useState<Booklet[]>([]);

  // Position assignment form
  const [assigningPosition, setAssigningPosition] = useState(false);
  const [editingPositionSubjectId, setEditingPositionSubjectId] = useState<string | null>(null);
  const [posSubjectId, setPosSubjectId] = useState("");
  const [posLevelId, setPosLevelId] = useState("");
  const [posSeriesId, setPosSeriesId] = useState("");
  const [posBookletId, setPosBookletId] = useState("");
  const [savingPosition, setSavingPosition] = useState(false);

  useEffect(() => {
    loadAll();
  }, [studentId]);

  async function loadAll() {
    setLoading(true);
    const [studRes, tutorRes, parentRes, posRes, allTutRes, allParRes, levelsRes, seriesRes, bookletsRes] = await Promise.all([
      fetch(`/api/students/${studentId}`),
      fetch(`/api/students/${studentId}/tutors`),
      fetch(`/api/students/${studentId}/parents`),
      fetch(`/api/students/${studentId}/positions`),
      fetch("/api/users?role=tutor"),
      fetch("/api/users?role=parent"),
      fetch("/api/curriculum/levels"),
      fetch("/api/curriculum/series"),
      fetch("/api/curriculum/booklets"),
    ]);

    const stud = await studRes.json();
    setStudent(stud);
    setForm({ name: stud.name, status: stud.status, notes: stud.notes || "" });
    setTutorLinks(await tutorRes.json());
    setParentLinks(await parentRes.json());
    setPositions(await posRes.json());
    setAllTutors(await allTutRes.json());
    setAllParents(await allParRes.json());

    const levelsData = await levelsRes.json();
    const seriesData = await seriesRes.json();
    const bookletsData = await bookletsRes.json();
    setLevels(levelsData);
    setAllSeries(seriesData);
    setAllBooklets(bookletsData);

    // Extract subjects from levels
    const subjectMap = new Map<string, Subject>();
    levelsData.forEach((l: CurriculumLevel & { subject: Subject }) => {
      if (l.subject) subjectMap.set(l.subject.id, l.subject);
    });
    setSubjects(Array.from(subjectMap.values()).sort((a, b) => a.sort_order - b.sort_order));

    setLoading(false);
  }

  async function saveStudent() {
    await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, status: form.status, notes: form.notes || null }),
    });
    setEditing(false);
    loadAll();
  }

  async function assignTutor() {
    if (!selectedTutorId) return;
    await fetch(`/api/students/${studentId}/tutors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutor_id: selectedTutorId }),
    });
    setAddingTutor(false);
    setSelectedTutorId("");
    loadAll();
  }

  async function removeTutor(tutorId: string) {
    await fetch(`/api/students/${studentId}/tutors?tutorId=${tutorId}`, { method: "DELETE" });
    loadAll();
  }

  async function assignParent() {
    if (!selectedParentId) return;
    await fetch(`/api/students/${studentId}/parents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: selectedParentId, relationship }),
    });
    setAddingParent(false);
    setSelectedParentId("");
    setRelationship("Parent");
    loadAll();
  }

  async function removeParent(parentId: string) {
    await fetch(`/api/students/${studentId}/parents?parentId=${parentId}`, { method: "DELETE" });
    loadAll();
  }

  function openAssignPosition() {
    setAssigningPosition(true);
    setEditingPositionSubjectId(null);
    setPosSubjectId("");
    setPosLevelId("");
    setPosSeriesId("");
    setPosBookletId("");
  }

  function openEditPosition(pos: StudentPosition) {
    setEditingPositionSubjectId(pos.subject_id);
    setAssigningPosition(false);
    setPosSubjectId(pos.subject_id);
    // Pre-select the current level/series/booklet
    const booklet = pos.current_booklet;
    const series = booklet?.series;
    const level = series?.level;
    setPosLevelId(level?.id || "");
    setPosSeriesId(series?.id || "");
    setPosBookletId(pos.current_booklet_id);
  }

  function cancelPositionForm() {
    setAssigningPosition(false);
    setEditingPositionSubjectId(null);
    setPosSubjectId("");
    setPosLevelId("");
    setPosSeriesId("");
    setPosBookletId("");
  }

  async function savePosition() {
    if (!posSubjectId || !posBookletId) return;
    setSavingPosition(true);
    await fetch(`/api/students/${studentId}/positions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: posSubjectId, current_booklet_id: posBookletId }),
    });
    setSavingPosition(false);
    cancelPositionForm();
    loadAll();
  }

  // Filtered curriculum for cascading dropdowns
  const filteredLevels = levels.filter((l) => l.subject_id === posSubjectId);
  const filteredSeries = allSeries.filter((s) => s.level_id === posLevelId);
  const filteredBooklets = allBooklets.filter((b) => b.series_id === posSeriesId);

  const showPositionForm = assigningPosition || editingPositionSubjectId !== null;
  // Subjects that already have a position (can't assign a new one for the same subject)
  const assignedSubjectIds = new Set(positions.map((p) => p.subject_id));

  if (loading || !student) {
    return <div className="flex items-center justify-center h-64"><p style={{ color: "var(--text-secondary)" }}>Loading...</p></div>;
  }

  const linkedTutorIds = new Set(tutorLinks.map((l) => l.tutor?.id));
  const linkedParentIds = new Set(parentLinks.map((l) => l.parent?.id));
  const availableTutors = allTutors.filter((t) => !linkedTutorIds.has(t.id));
  const availableParents = allParents.filter((p) => !linkedParentIds.has(p.id));

  return (
    <div>
      <button
        onClick={() => router.push("/admin/students")}
        className="text-sm mb-4 inline-flex items-center gap-1 font-semibold"
        style={{ color: "var(--gideon-blue)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Students
      </button>

      {/* Student Info */}
      <div className="card mb-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl" style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}>{student.name}</h1>
          <button className="btn btn-secondary text-sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" />
            <button className="btn btn-primary" onClick={saveStudent}>Save</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p style={{ color: "var(--text-muted)" }}>Status</p>
              <span className={`badge badge-${student.status === "active" ? "success" : student.status === "graduated" ? "warning" : "error"}`}>
                {student.status}
              </span>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Enrolled</p>
              <p style={{ color: "var(--text-primary)" }}>{formatDate(student.enrollment_date)}</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Date of Birth</p>
              <p style={{ color: "var(--text-primary)" }}>{student.date_of_birth ? formatDate(student.date_of_birth) : "—"}</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>Notes</p>
              <p style={{ color: "var(--text-primary)" }}>{student.notes || "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Positions */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Current Position</h2>
          {!showPositionForm && (
            <button className="text-sm font-medium" style={{ color: "var(--gideon-blue)" }} onClick={openAssignPosition}>
              + Assign Position
            </button>
          )}
        </div>

        {/* Position Assignment / Edit Form */}
        {showPositionForm && (
          <div className="p-4 rounded-lg mb-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              {editingPositionSubjectId ? "Edit Position" : "Assign Position"}
            </h3>
            <div className="space-y-3">
              {/* Subject */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Subject</label>
                {editingPositionSubjectId ? (
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {subjects.find((s) => s.id === posSubjectId)?.name}
                  </p>
                ) : (
                  <select
                    className="select"
                    value={posSubjectId}
                    onChange={(e) => {
                      setPosSubjectId(e.target.value);
                      setPosLevelId("");
                      setPosSeriesId("");
                      setPosBookletId("");
                    }}
                  >
                    <option value="">Select subject...</option>
                    {subjects
                      .filter((s) => !assignedSubjectIds.has(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                )}
              </div>

              {/* Level */}
              {posSubjectId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Level</label>
                  <select
                    className="select"
                    value={posLevelId}
                    onChange={(e) => {
                      setPosLevelId(e.target.value);
                      setPosSeriesId("");
                      setPosBookletId("");
                    }}
                  >
                    <option value="">Select level...</option>
                    {filteredLevels.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Series */}
              {posLevelId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Series</label>
                  <select
                    className="select"
                    value={posSeriesId}
                    onChange={(e) => {
                      setPosSeriesId(e.target.value);
                      setPosBookletId("");
                    }}
                  >
                    <option value="">Select series...</option>
                    {filteredSeries.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Booklet */}
              {posSeriesId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Booklet</label>
                  <select
                    className="select"
                    value={posBookletId}
                    onChange={(e) => setPosBookletId(e.target.value)}
                  >
                    <option value="">Select booklet...</option>
                    {filteredBooklets.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn btn-primary text-sm"
                  onClick={savePosition}
                  disabled={!posBookletId || savingPosition}
                >
                  {savingPosition ? "Saving..." : "Save"}
                </button>
                <button className="btn btn-secondary text-sm" onClick={cancelPositionForm}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {positions.length === 0 && !showPositionForm ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No positions set. Click &ldquo;Assign Position&rdquo; to set a starting booklet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map((pos) => (
              <div key={pos.id} className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`badge badge-${pos.subject?.slug === "reading" ? "reading" : "math"}`}>
                    {pos.subject?.name}
                  </span>
                  <button
                    className="text-xs font-medium"
                    style={{ color: "var(--gideon-blue)" }}
                    onClick={() => openEditPosition(pos)}
                  >
                    Edit
                  </button>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {pos.current_booklet?.series?.level?.name} &rsaquo; {pos.current_booklet?.series?.name} &rsaquo; Booklet {pos.current_booklet?.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assigned Tutors */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Assigned Tutors</h2>
            <button className="text-sm font-medium" style={{ color: "var(--gideon-blue)" }} onClick={() => setAddingTutor(!addingTutor)}>
              {addingTutor ? "Cancel" : "+ Assign"}
            </button>
          </div>
          {addingTutor && (
            <div className="flex gap-2 mb-3">
              <select className="select flex-1" value={selectedTutorId} onChange={(e) => setSelectedTutorId(e.target.value)}>
                <option value="">Select tutor...</option>
                {availableTutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn btn-primary text-sm" onClick={assignTutor}>Add</button>
            </div>
          )}
          {tutorLinks.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tutors assigned</p>
          ) : (
            <div className="space-y-2">
              {tutorLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--bg-secondary)" }}>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{link.tutor?.name}</span>
                  <button onClick={() => removeTutor(link.tutor?.id)} className="text-xs" style={{ color: "var(--error)" }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Parents */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Linked Parents/Family</h2>
            <button className="text-sm font-medium" style={{ color: "var(--gideon-blue)" }} onClick={() => setAddingParent(!addingParent)}>
              {addingParent ? "Cancel" : "+ Link"}
            </button>
          </div>
          {addingParent && (
            <div className="flex gap-2 mb-3">
              <select className="select flex-1" value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)}>
                <option value="">Select parent...</option>
                {availableParents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
              </select>
              <input className="input w-28" placeholder="Relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
              <button className="btn btn-primary text-sm" onClick={assignParent}>Add</button>
            </div>
          )}
          {parentLinks.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No parents linked</p>
          ) : (
            <div className="space-y-2">
              {parentLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--bg-secondary)" }}>
                  <div>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{link.parent?.name}</span>
                    <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{link.relationship}</span>
                  </div>
                  <button onClick={() => removeParent(link.parent?.id)} className="text-xs" style={{ color: "var(--error)" }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
