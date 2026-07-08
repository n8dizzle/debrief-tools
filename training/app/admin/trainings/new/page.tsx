"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StepType = "video" | "document" | "quiz" | "signature";
interface QQ { prompt: string; choices: string[]; correct_index: number; }
interface Step { type: StepType; url?: string; questions?: QQ[]; pass_threshold?: number; policy_text?: string; }

export default function NewTrainingPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addStep = (type: StepType) =>
    setSteps((s) => [...s,
      type === "quiz" ? { type, questions: [{ prompt: "", choices: ["", ""], correct_index: 0 }], pass_threshold: 80 }
      : type === "signature" ? { type, policy_text: "" }
      : { type, url: "" }]);
  const update = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const remove = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  async function save() {
    setErr(null);
    if (!title.trim()) { setErr("Give it a title."); return; }
    if (!steps.length) { setErr("Add at least one step."); return; }
    // shape config per step type
    const payloadSteps = steps.map((s) => {
      if (s.type === "quiz") return { type: "quiz", config: { questions: s.questions, pass_threshold: s.pass_threshold ?? 80 } };
      if (s.type === "signature") return { type: "signature", config: { policy_text: s.policy_text } };
      return { type: s.type, config: { source: "link", url: s.url } };
    });
    setBusy(true);
    try {
      const res = await fetch("/api/admin/trainings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status: "published", steps: payloadSteps }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data.error || "Save failed"); setBusy(false); return; }
      router.push(`/admin/trainings/${data.id}`);
    } catch { setErr("Network error"); setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>New training</h1>
      <label style={lbl}>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warranty Callback SOP" style={inp} />
      <label style={lbl}>Description (optional)</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line techs will see" style={inp} />

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "24px 0 8px" }}>Steps</h2>
      {steps.map((s, i) => (
        <div key={i} style={stepCard}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ textTransform: "capitalize" }}>{i + 1}. {s.type}</strong>
            <button onClick={() => remove(i)} style={linkBtn}>remove</button>
          </div>
          {(s.type === "video" || s.type === "document") && (
            <input value={s.url || ""} onChange={(e) => update(i, { url: e.target.value })}
              placeholder={s.type === "video" ? "Video link (YouTube/Vimeo/mp4)" : "Document link (PDF URL)"} style={inp} />
          )}
          {s.type === "quiz" && <QuizEditor step={s} onChange={(patch) => update(i, patch)} />}
          {s.type === "signature" && (
            <textarea value={s.policy_text || ""} onChange={(e) => update(i, { policy_text: e.target.value })}
              placeholder="Policy text the tech reads and signs (e.g. the safety policy)…" rows={5} style={{ ...inp, resize: "vertical" }} />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button onClick={() => addStep("video")} style={addBtn}>+ Video</button>
        <button onClick={() => addStep("document")} style={addBtn}>+ Document</button>
        <button onClick={() => addStep("quiz")} style={addBtn}>+ Quiz</button>
        <button onClick={() => addStep("signature")} style={addBtn}>+ Signature</button>
      </div>

      {err && <p style={{ color: "var(--status-error)", marginTop: 16 }}>{err}</p>}
      <button onClick={save} disabled={busy} style={{ marginTop: 24, padding: "14px 24px", borderRadius: 10, border: "none", background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 700, fontSize: 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Saving…" : "Save & continue to assign"}
      </button>
    </main>
  );
}

function QuizEditor({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  const qs = step.questions || [];
  const setQ = (qi: number, patch: Partial<QQ>) => onChange({ questions: qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  return (
    <div>
      {qs.map((q, qi) => (
        <div key={qi} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, marginTop: 10 }}>
          <input value={q.prompt} onChange={(e) => setQ(qi, { prompt: e.target.value })} placeholder={`Question ${qi + 1}`} style={inp} />
          {q.choices.map((c, ci) => (
            <div key={ci} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" name={`correct-${qi}-${step.questions?.length}`} checked={q.correct_index === ci} onChange={() => setQ(qi, { correct_index: ci })} title="correct answer" />
              <input value={c} onChange={(e) => setQ(qi, { choices: q.choices.map((x, i) => (i === ci ? e.target.value : x)) })} placeholder={`Choice ${ci + 1}`} style={{ ...inp, marginBottom: 0 }} />
            </div>
          ))}
          <button onClick={() => setQ(qi, { choices: [...q.choices, ""] })} style={linkBtn}>+ choice</button>
          <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>(select the radio for the correct answer)</span>
        </div>
      ))}
      <button onClick={() => onChange({ questions: [...qs, { prompt: "", choices: ["", ""], correct_index: 0 }] })} style={{ ...addBtn, marginTop: 10 }}>+ Question</button>
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Pass threshold %: </label>
        <input type="number" value={step.pass_threshold ?? 80} onChange={(e) => onChange({ pass_threshold: Number(e.target.value) })} style={{ ...inp, width: 80, display: "inline-block", marginBottom: 0 }} />
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 13, color: "var(--text-secondary)", marginTop: 12, marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 15, marginBottom: 8 };
const stepCard: React.CSSProperties = { border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14, marginBottom: 10 };
const addBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--christmas-green-light)", cursor: "pointer", fontSize: 13 };
