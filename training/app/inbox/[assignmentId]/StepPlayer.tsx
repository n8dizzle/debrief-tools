"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export interface ClientStep {
  id: string;
  type: string; // video | document | quiz | signature
  config: Record<string, unknown>;
}

export default function StepPlayer({
  assignmentId, trainingTitle, steps, completedStepIds, alreadyComplete,
}: {
  assignmentId: string; trainingTitle: string; steps: ClientStep[];
  completedStepIds: string[]; alreadyComplete: boolean;
}) {
  const doneSet = useMemo(() => new Set(completedStepIds), [completedStepIds]);
  const firstIncomplete = steps.findIndex((s) => !doneSet.has(s.id));
  const [index, setIndex] = useState(firstIncomplete === -1 ? steps.length : firstIncomplete);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [finished, setFinished] = useState(alreadyComplete || firstIncomplete === -1);

  async function submit(step: ClientStep, payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/tech/complete-step", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, step_id: step.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data.error || "Something went wrong"); return false; }
      if (data.passed === false) { setErr(`Score ${data.score}%. You need ${data.threshold}% — try again.`); return false; }
      if (data.completed) setFinished(true);
      else setIndex((i) => i + 1);
      return true;
    } catch { setErr("Network error — try again"); return false; }
    finally { setBusy(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100dvh", padding: 16, maxWidth: 560, margin: "0 auto" };
  const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 20 };

  if (finished) {
    return (
      <main style={{ ...wrap, display: "grid", placeItems: "center" }}>
        <div style={{ ...card, textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 52 }}>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 6px" }}>All done!</h1>
          <p style={{ color: "var(--text-secondary)" }}>You finished “{trainingTitle}”. Nice work.</p>
          <Link href="/inbox" style={{ display: "inline-block", marginTop: 20, padding: "12px 20px", borderRadius: 10, background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 700, textDecoration: "none" }}>
            Back to my trainings
          </Link>
        </div>
      </main>
    );
  }

  const step = steps[index];
  if (!step) return null;

  return (
    <main style={wrap}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{trainingTitle} · step {index + 1} of {steps.length}</div>
      <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 2, marginBottom: 16 }}>
        <div style={{ width: `${(index / steps.length) * 100}%`, height: "100%", background: "var(--christmas-green)", borderRadius: 2 }} />
      </div>
      <div style={card}>
        {step.type === "video" && <VideoStep step={step} busy={busy} onDone={(pct) => submit(step, { watch_pct: pct })} />}
        {step.type === "document" && <DocStep step={step} busy={busy} onDone={() => submit(step, {})} />}
        {step.type === "quiz" && <QuizStep step={step} busy={busy} onSubmit={(answers) => submit(step, { answers })} />}
        {step.type === "signature" && <SignatureStep step={step} busy={busy} onSign={(name, sig) => submit(step, { typed_name: name, signature: sig })} />}
        {err && <p style={{ color: "var(--status-error)", marginTop: 14, fontSize: 14 }}>{err}</p>}
      </div>
    </main>
  );
}

function primaryBtn(busy: boolean): React.CSSProperties {
  return { marginTop: 20, width: "100%", padding: 16, borderRadius: 12, border: "none", background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 700, fontSize: 17, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 };
}

function VideoStep({ step, busy, onDone }: { step: ClientStep; busy: boolean; onDone: (pct: number) => void }) {
  const url = String(step.config.url || "");
  const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/.test(url);
  const embedUrl = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
  return (
    <div>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        {isEmbed ? (
          <iframe src={embedUrl} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        ) : (
          <video src={url} controls style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        )}
      </div>
      <button disabled={busy} onClick={() => onDone(100)} style={primaryBtn(busy)}>{busy ? "Saving…" : "I watched it ✓"}</button>
    </div>
  );
}

function DocStep({ step, busy, onDone }: { step: ClientStep; busy: boolean; onDone: () => void }) {
  const url = String(step.config.url || "");
  const [read, setRead] = useState(false);
  return (
    <div>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-subtle)", height: 420 }}>
        <iframe src={url} style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, color: "var(--christmas-green-light)", fontSize: 14 }}>Open full document ↗</a>
      <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, fontSize: 15 }}>
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} style={{ width: 18, height: 18 }} />
        I have read and understand this document.
      </label>
      <button disabled={busy || !read} onClick={onDone} style={{ ...primaryBtn(busy), opacity: busy || !read ? 0.5 : 1, cursor: !read ? "not-allowed" : "pointer" }}>
        {busy ? "Saving…" : "Mark complete ✓"}
      </button>
    </div>
  );
}

function SignatureStep({ step, busy, onSign }: { step: ClientStep; busy: boolean; onSign: (name: string, sig: string) => void }) {
  const policy = String(step.config.policy_text || "");
  const [phase, setPhase] = useState<"read" | "code" | "sign">("read");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    if (phase !== "sign") return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.strokeStyle = "#F5F0E1"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { drawing.current = true; hasInk.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const up = () => { drawing.current = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [phase]);

  async function requestCode() {
    setSending(true); setNote(null);
    try {
      const res = await fetch("/api/tech/otp/request", { method: "POST" });
      const d = await res.json();
      if (res.ok && d.ok) { setPhase("code"); setNote("We texted you a 6-digit code."); }
      else setNote(d.error || "Could not send code");
    } catch { setNote("Network error"); } finally { setSending(false); }
  }
  async function verify() {
    setSending(true); setNote(null);
    try {
      const res = await fetch("/api/tech/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const d = await res.json();
      if (res.ok && d.ok) { setPhase("sign"); setNote(null); }
      else setNote(d.error || "Wrong code");
    } catch { setNote("Network error"); } finally { setSending(false); }
  }
  function submitSig() {
    if (!name.trim()) { setNote("Type your full legal name."); return; }
    if (!hasInk.current) { setNote("Please draw your signature."); return; }
    const dataUrl = canvasRef.current?.toDataURL("image/png") || "";
    onSign(name.trim(), dataUrl);
  }
  function clearSig() {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); hasInk.current = false; }
  }

  return (
    <div>
      <div style={{ maxHeight: 240, overflowY: "auto", padding: 14, border: "1px solid var(--border-subtle)", borderRadius: 10, background: "var(--bg-secondary)", whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>
        {policy || "Please acknowledge this policy."}
      </div>

      {phase === "read" && (
        <button disabled={busy || sending} onClick={requestCode} style={primaryBtn(busy || sending)}>
          {sending ? "Texting code…" : "Sign this — text me a code"}
        </button>
      )}

      {phase === "code" && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 14, color: "var(--text-secondary)" }}>Enter the 6-digit code we texted you</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="input" style={{ marginTop: 6, letterSpacing: 6, fontSize: 20, textAlign: "center" }} />
          <button disabled={busy || sending || code.length < 6} onClick={verify} style={{ ...primaryBtn(busy || sending), opacity: code.length < 6 ? 0.5 : 1 }}>
            {sending ? "Checking…" : "Verify"}
          </button>
          <button onClick={requestCode} style={{ background: "none", border: "none", color: "var(--christmas-green-light)", marginTop: 10, cursor: "pointer", fontSize: 14 }}>Resend code</button>
        </div>
      )}

      {phase === "sign" && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 14, color: "var(--text-secondary)" }}>Type your full legal name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" style={{ marginTop: 6, marginBottom: 12 }} />
          <label style={{ fontSize: 14, color: "var(--text-secondary)" }}>Draw your signature</label>
          <div style={{ marginTop: 6, border: "1px solid var(--border-default)", borderRadius: 10, background: "var(--bg-card)" }}>
            <canvas ref={canvasRef} width={480} height={160} style={{ width: "100%", height: 160, touchAction: "none", display: "block" }} />
          </div>
          <button onClick={clearSig} style={{ background: "none", border: "none", color: "var(--text-muted)", marginTop: 8, cursor: "pointer", fontSize: 13 }}>Clear</button>
          <button disabled={busy} onClick={submitSig} style={primaryBtn(busy)}>{busy ? "Saving…" : "I agree & sign ✓"}</button>
        </div>
      )}

      {note && <p style={{ color: note.includes("texted") ? "var(--text-secondary)" : "var(--status-error)", marginTop: 12, fontSize: 14 }}>{note}</p>}
    </div>
  );
}

function QuizStep({ step, busy, onSubmit }: { step: ClientStep; busy: boolean; onSubmit: (answers: number[]) => void }) {
  const questions = (step.config.questions as Array<{ prompt: string; choices: string[] }>) || [];
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const allAnswered = answers.every((a) => a >= 0);
  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{qi + 1}. {q.prompt}</div>
          {q.choices.map((c, ci) => (
            <label key={ci} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border-subtle)", borderRadius: 8, marginBottom: 6, cursor: "pointer", background: answers[qi] === ci ? "var(--bg-card-hover)" : "transparent" }}>
              <input type="radio" name={`q${qi}`} checked={answers[qi] === ci} onChange={() => setAnswers((a) => { const n = [...a]; n[qi] = ci; return n; })} />
              {c}
            </label>
          ))}
        </div>
      ))}
      <button disabled={busy || !allAnswered} onClick={() => onSubmit(answers)} style={{ ...primaryBtn(busy), opacity: busy || !allAnswered ? 0.5 : 1 }}>
        {busy ? "Checking…" : "Submit answers"}
      </button>
    </div>
  );
}
