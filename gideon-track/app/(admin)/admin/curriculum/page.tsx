"use client";

import { useEffect, useState } from "react";
import type { Subject, CurriculumLevel, Series, Booklet } from "@/lib/supabase";

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [allBooklets, setAllBooklets] = useState<Booklet[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Add forms
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [showAddSeries, setShowAddSeries] = useState<string | null>(null);
  const [showAddBooklet, setShowAddBooklet] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [levelsRes, seriesRes, bookletsRes] = await Promise.all([
        fetch("/api/curriculum/levels"),
        fetch("/api/curriculum/series"),
        fetch("/api/curriculum/booklets"),
      ]);
      const levelsData = await levelsRes.json();
      const seriesData = await seriesRes.json();
      const bookletsData = await bookletsRes.json();

      setLevels(levelsData);
      setAllSeries(seriesData);
      setAllBooklets(bookletsData);

      // Extract unique subjects from levels
      const subjectMap = new Map<string, Subject>();
      levelsData.forEach((l: CurriculumLevel & { subject: Subject }) => {
        if (l.subject) subjectMap.set(l.subject.id, l.subject);
      });
      const subs = Array.from(subjectMap.values()).sort((a, b) => a.sort_order - b.sort_order);
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubject) setSelectedSubject(subs[0].id);
    } catch (err) {
      console.error("Failed to load curriculum", err);
    } finally {
      setLoading(false);
    }
  }

  async function addLevel() {
    if (!newName.trim() || !selectedSubject) return;
    const maxOrder = levels
      .filter((l) => l.subject_id === selectedSubject)
      .reduce((max, l) => Math.max(max, l.sort_order), -1);

    await fetch("/api/curriculum/levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject_id: selectedSubject,
        name: newName.trim(),
        passing_threshold: newThreshold ? parseInt(newThreshold) : 3,
        sort_order: maxOrder + 1,
      }),
    });
    setNewName("");
    setNewThreshold("");
    setShowAddLevel(false);
    loadData();
  }

  async function addSeries(levelId: string) {
    if (!newName.trim()) return;
    const maxOrder = allSeries
      .filter((s) => s.level_id === levelId)
      .reduce((max, s) => Math.max(max, s.sort_order), -1);

    await fetch("/api/curriculum/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level_id: levelId,
        name: newName.trim(),
        passing_threshold_override: newThreshold ? parseInt(newThreshold) : null,
        sort_order: maxOrder + 1,
      }),
    });
    setNewName("");
    setNewThreshold("");
    setShowAddSeries(null);
    loadData();
  }

  async function addBooklet(seriesId: string) {
    if (!newName.trim()) return;
    const maxOrder = allBooklets
      .filter((b) => b.series_id === seriesId)
      .reduce((max, b) => Math.max(max, b.sort_order), -1);

    await fetch("/api/curriculum/booklets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        series_id: seriesId,
        name: newName.trim(),
        passing_threshold_override: newThreshold ? parseInt(newThreshold) : null,
        sort_order: maxOrder + 1,
      }),
    });
    setNewName("");
    setNewThreshold("");
    setShowAddBooklet(null);
    loadData();
  }

  const filteredLevels = levels
    .filter((l) => l.subject_id === selectedSubject)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--text-secondary)" }}>Loading curriculum...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1
          className="text-2xl"
          style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
        >
          Curriculum
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage subjects, levels, series, and booklets
        </p>
      </div>

      {/* Subject tabs */}
      <div className="flex gap-2 mb-6">
        {subjects.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubject(sub.id)}
            className="btn"
            style={{
              background: selectedSubject === sub.id ? sub.color : "transparent",
              color: selectedSubject === sub.id ? "white" : "var(--text-secondary)",
              border: `1px solid ${selectedSubject === sub.id ? sub.color : "var(--border-default)"}`,
            }}
          >
            {sub.name}
          </button>
        ))}
      </div>

      {/* Levels */}
      <div className="space-y-4">
        {filteredLevels.map((level) => {
          const levelSeries = allSeries
            .filter((s) => s.level_id === level.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <div key={level.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {level.name}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Pass threshold: {level.passing_threshold} mistakes
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddSeries(level.id); setNewName(""); setNewThreshold(""); }}
                  className="btn btn-secondary text-xs"
                >
                  + Series
                </button>
              </div>

              {/* Add series form */}
              {showAddSeries === level.id && (
                <div className="flex gap-2 mb-3 p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <input
                    className="input flex-1"
                    placeholder="Series name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="input w-32"
                    placeholder="Threshold (opt)"
                    type="number"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => addSeries(level.id)}>Add</button>
                  <button className="btn btn-secondary" onClick={() => setShowAddSeries(null)}>Cancel</button>
                </div>
              )}

              {/* Series list */}
              {levelSeries.length === 0 ? (
                <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No series yet</p>
              ) : (
                <div className="space-y-3 ml-4">
                  {levelSeries.map((series) => {
                    const seriesBooklets = allBooklets
                      .filter((b) => b.series_id === series.id)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <div key={series.id} className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                              {series.name}
                            </h3>
                            {series.passing_threshold_override !== null && (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Threshold override: {series.passing_threshold_override}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => { setShowAddBooklet(series.id); setNewName(""); setNewThreshold(""); }}
                            className="text-xs font-medium"
                            style={{ color: "var(--gideon-blue)" }}
                          >
                            + Booklet
                          </button>
                        </div>

                        {/* Add booklet form */}
                        {showAddBooklet === series.id && (
                          <div className="flex gap-2 mb-2">
                            <input
                              className="input flex-1"
                              placeholder="Booklet name (e.g. A, B, C)"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              autoFocus
                            />
                            <input
                              className="input w-32"
                              placeholder="Threshold"
                              type="number"
                              value={newThreshold}
                              onChange={(e) => setNewThreshold(e.target.value)}
                            />
                            <button className="btn btn-primary text-xs" onClick={() => addBooklet(series.id)}>Add</button>
                            <button className="btn btn-secondary text-xs" onClick={() => setShowAddBooklet(null)}>Cancel</button>
                          </div>
                        )}

                        {/* Booklets */}
                        <div className="flex flex-wrap gap-2">
                          {seriesBooklets.map((booklet) => (
                            <span
                              key={booklet.id}
                              className="badge"
                              style={{
                                background: "var(--gideon-blue-light)",
                                color: "var(--gideon-blue-dark)",
                              }}
                            >
                              {booklet.name}
                              {booklet.passing_threshold_override !== null && (
                                <span className="ml-1 opacity-60">({booklet.passing_threshold_override})</span>
                              )}
                            </span>
                          ))}
                          {seriesBooklets.length === 0 && (
                            <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>No booklets</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Add level */}
        {showAddLevel ? (
          <div className="card">
            <h3 className="font-medium mb-3" style={{ color: "var(--text-primary)" }}>Add Level</h3>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Level name (e.g. C-2, D-1)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <input
                className="input w-40"
                placeholder="Pass threshold"
                type="number"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addLevel}>Add</button>
              <button className="btn btn-secondary" onClick={() => { setShowAddLevel(false); setNewName(""); setNewThreshold(""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddLevel(true); setNewName(""); setNewThreshold(""); }}
            className="btn btn-secondary w-full"
          >
            + Add Level
          </button>
        )}
      </div>
    </div>
  );
}
