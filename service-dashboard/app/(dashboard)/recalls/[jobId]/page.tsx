'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useServiceDashboardPermissions } from '@/hooks/usePermissions';

interface Question { id: string; question: string; assigned_to: string | null; status: string; answer: string | null; answered_via?: string | null; }
interface Investigation { id: string; status: string; root_cause_category: string | null; root_cause_note: string | null; }
interface Detail {
  job_id: number;
  recall: { st_original_job_id: number; tech_name: string | null; recall_created_on: string; days_to_recall: number | null; customer_name: string | null; business_unit_name: string | null } | null;
  equipment: { manufacturer: string | null; model: string | null; installed_on: string | null } | null;
  investigation: Investigation | null;
  questions: Question[];
  activity: { id: string; action: string; created_at: string }[];
  root_cause_categories: string[];
  job_details?: {
    recall: { summary: string | null; notes: { text: string; createdOn?: string }[] } | null;
    original: { job_id: number; summary: string | null; notes: { text: string; createdOn?: string }[] } | null;
  } | null;
}

function JobDetailBlock({ label, jobId, data }: { label: string; jobId?: number; data: { summary: string | null; notes: { text: string; createdOn?: string }[] } | null }) {
  if (!data) return null;
  const hasSummary = !!data.summary?.trim();
  const notes = data.notes || [];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {label}{jobId ? ` (job #${jobId})` : ''}
      </div>
      {hasSummary
        ? <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{data.summary}</div>
        : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No summary of work.</div>}
      {notes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Notes:</div>
          {notes.map((n, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '2px 0 2px 10px', borderLeft: '2px solid var(--border-default)', marginBottom: 4, whiteSpace: 'pre-wrap' }}>
              {n.text}{n.createdOn ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> · {new Date(n.createdOn).toLocaleDateString()}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ST_BASE = 'https://go.servicetitan.com';
const PANEL: React.CSSProperties = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 };

export default function RcaPage() {
  const params = useParams();
  const jobId = String(params.jobId);
  const { canInvestigate } = useServiceDashboardPermissions();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [suggestion, setSuggestion] = useState<{ root_cause_category: string; rationale: string; research_questions: string[] } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/recalls/${jobId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      setD(await res.json());
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  const saveInvestigation = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/recalls/${jobId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || 'Save failed'); return; }
      await load();
    } finally { setSaving(false); }
  };

  const getSuggestion = async () => {
    setSuggesting(true); setSuggestErr(null); setSuggestion(null);
    try {
      const res = await fetch(`/api/recalls/${jobId}/suggest`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setSuggestErr(body.error || `Error ${res.status}`); return; }
      setSuggestion(body.suggestion);
    } catch (e) { setSuggestErr((e as Error).message); } finally { setSuggesting(false); }
  };

  const questionExists = (text: string) =>
    (d?.questions || []).some((qq) => qq.question.trim().toLowerCase() === text.trim().toLowerCase());

  const addQuestionText = async (raw: string) => {
    const text = raw.trim();
    if (!text || questionExists(text)) return; // skip empty or duplicate
    await fetch(`/api/recalls/${jobId}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text }) });
    await load();
  };

  const addQuestion = async () => {
    const text = newQ.trim();
    if (!text) return;
    setNewQ('');
    await addQuestionText(text);
  };
  const answerQuestion = async (id: string, answer: string) => {
    await fetch(`/api/recalls/${jobId}/questions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, answer }) });
    await load();
  };
  const deleteQuestion = async (id: string) => {
    await fetch(`/api/recalls/${jobId}/questions`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  };
  const [textResults, setTextResults] = useState<Record<string, { sent: boolean; to?: string; link?: string; message?: string; error?: string; loading?: boolean }>>({});
  const textTech = async (id: string) => {
    setTextResults(prev => ({ ...prev, [id]: { sent: false, loading: true } }));
    try {
      const res = await fetch(`/api/recalls/${jobId}/questions/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setTextResults(prev => ({ ...prev, [id]: { sent: false, error: body.error || `Error ${res.status}` } })); return; }
      setTextResults(prev => ({ ...prev, [id]: body })); // {sent:true,to} or {sent:false,link,message,error}
    } catch (e) { setTextResults(prev => ({ ...prev, [id]: { sent: false, error: (e as Error).message } })); }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading investigation…</div>;
  if (error) return <div style={{ padding: 24, color: 'var(--status-error)' }}>{error} — <Link href="/recalls/queue" style={{ color: 'var(--christmas-green-light)' }}>back to queue</Link></div>;
  if (!d) return null;

  const inv = d.investigation;
  const status = inv?.status || 'open';
  const rootCause = inv?.root_cause_category || '';
  const canResolve = !!rootCause;

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <Link href="/recalls/queue" style={{ color: 'var(--christmas-green-light)', fontSize: 13 }}>← Recall queue</Link>

      {/* Header / job context */}
      <div style={{ ...PANEL, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Recall #{d.job_id}</h1>
            {d.recall ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
                {d.recall.customer_name || 'Customer'} · {d.recall.business_unit_name || '—'}
                <br />Original job #{d.recall.st_original_job_id} · Tech: {d.recall.tech_name || '—'}
                {d.recall.days_to_recall != null && ` · ${d.recall.days_to_recall} days to recall`}
              </p>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>No recall record cached for this job (investigation on a searched job).</p>}
            {d.equipment && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
                Equipment: {[d.equipment.manufacturer, d.equipment.model].filter(Boolean).join(' ') || '—'}
                {d.equipment.installed_on && ` · installed ${d.equipment.installed_on}`}
              </p>
            )}
          </div>
          <a href={`${ST_BASE}/Job/Index/${d.job_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--christmas-green-light)', fontSize: 13 }}>Open in ServiceTitan ↗</a>
        </div>
      </div>

      {/* Job details (summary + notes from ServiceTitan) */}
      {d.job_details && (
        <div style={PANEL}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Job details</h2>
          <JobDetailBlock label="Recall job" jobId={d.job_id} data={d.job_details.recall} />
          {d.job_details.original && <JobDetailBlock label="Original job" jobId={d.job_details.original.job_id} data={d.job_details.original} />}
        </div>
      )}

      {/* Root cause + status */}
      <div style={PANEL}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Root cause</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={rootCause}
            disabled={!canInvestigate || saving}
            onChange={e => saveInvestigation({ root_cause_category: e.target.value, status: status === 'open' ? 'investigating' : status })}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 14, minWidth: 240, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          >
            <option value="">Select a root cause…</option>
            {d.root_cause_categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{status}</strong></span>
          {canInvestigate && (
            <button onClick={getSuggestion} disabled={suggesting}
              style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: suggesting ? 'wait' : 'pointer', backgroundColor: 'transparent', color: 'var(--christmas-green-light)', border: '1px solid var(--border-default)' }}>
              {suggesting ? 'Thinking…' : '✨ Suggest root cause'}
            </button>
          )}
        </div>

        {suggestErr && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--status-error)' }}>{suggestErr}</div>}
        {suggestion && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px dashed var(--border-default)', backgroundColor: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>AI suggestion (confirm or ignore — not applied automatically)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{suggestion.root_cause_category}</strong>
              {canInvestigate && (
                <button onClick={() => saveInvestigation({ root_cause_category: suggestion.root_cause_category, status: status === 'open' ? 'investigating' : status })}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer', backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>Use this</button>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{suggestion.rationale}</div>
            {suggestion.research_questions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Suggested questions:</div>
                {suggestion.research_questions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>
                    <span>• {q}</span>
                    {canInvestigate && (
                      questionExists(q)
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>✓ Added</span>
                        : <button onClick={() => addQuestionText(q)}
                            style={{ fontSize: 12, color: 'var(--christmas-green-light)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {canInvestigate && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            {status !== 'resolved' ? (
              <button
                onClick={() => saveInvestigation({ status: 'resolved' })}
                disabled={!canResolve || saving}
                title={canResolve ? '' : 'Set a root cause first'}
                style={{ padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none',
                  cursor: canResolve ? 'pointer' : 'not-allowed', opacity: canResolve ? 1 : 0.5,
                  backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
              >Mark resolved</button>
            ) : (
              <button onClick={() => saveInvestigation({ status: 'investigating' })} disabled={saving}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
              >Re-open</button>
            )}
          </div>
        )}
      </div>

      {/* Research questions */}
      <div style={PANEL}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Research questions</h2>
        {d.questions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>No questions yet — add the first one to start the investigation.</p>}
        {d.questions.map(q => (
          <QuestionRow key={q.id} q={q} canInvestigate={canInvestigate} onAnswer={answerQuestion} onDelete={deleteQuestion} onTextTech={textTech} textResult={textResults[q.id]} />
        ))}
        {canInvestigate && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={newQ} onChange={e => setNewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuestion()}
              placeholder="Add a research question…"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 14, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
            <button onClick={addQuestion} style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>Add</button>
          </div>
        )}
      </div>

      {/* Activity */}
      {d.activity.length > 0 && (
        <details style={PANEL}>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>Activity ({d.activity.length})</summary>
          <div style={{ marginTop: 10 }}>
            {d.activity.map(a => (
              <div key={a.id} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
                {new Date(a.created_at).toLocaleString()} — {a.action}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function QuestionRow({ q, canInvestigate, onAnswer, onDelete, onTextTech, textResult }: { q: Question; canInvestigate: boolean; onAnswer: (id: string, a: string) => void; onDelete: (id: string) => void; onTextTech: (id: string) => void; textResult?: { sent: boolean; to?: string; link?: string; message?: string; error?: string; loading?: boolean } }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null);
  const answered = q.status === 'answered';
  const copy = (text: string, which: 'link' | 'msg') => { navigator.clipboard?.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 1500); };
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{q.question}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: answered ? 'var(--status-success)' : 'var(--status-info)' }}>{answered ? 'Answered' : 'Open'}</span>
          {canInvestigate && (
            <button onClick={() => { if (confirm('Delete this question?')) onDelete(q.id); }}
              title="Delete question"
              style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </span>
      </div>
      {q.answer && <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6, paddingLeft: 12, borderLeft: '2px solid var(--border-default)' }}>{q.answer}</div>}
      {canInvestigate && !answered && !editing && (
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: 'var(--christmas-green-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Answer</button>
          <button onClick={() => onTextTech(q.id)} disabled={textResult?.loading} title="Text this question to the original technician" style={{ fontSize: 12, color: 'var(--christmas-green-light)', background: 'none', border: 'none', cursor: textResult?.loading ? 'wait' : 'pointer', padding: 0 }}>
            {textResult?.loading ? 'Texting…' : '📱 Text the tech'}
          </button>
        </div>
      )}
      {textResult?.sent && !answered && (
        <div style={{ fontSize: 12, color: 'var(--status-success)', marginTop: 6 }}>✓ Texted to {textResult.to} — their answer will appear here.</div>
      )}
      {textResult && !textResult.sent && !textResult.loading && (textResult.link || textResult.error) && !answered && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: textResult.link ? 6 : 0 }}>{textResult.error || 'Could not text automatically.'}</div>
          {textResult.link && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: 8 }}>{textResult.link}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => copy(textResult.message || textResult.link!, 'msg')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>{copied === 'msg' ? 'Copied ✓' : 'Copy text message'}</button>
                <button onClick={() => copy(textResult.link!, 'link')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>{copied === 'link' ? 'Copied ✓' : 'Copy link only'}</button>
              </div>
            </>
          )}
        </div>
      )}
      {answered && q.answered_via === 'tech_link' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>answered by tech via link</div>
      )}
      {editing && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="Answer…"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
          <button onClick={() => { onAnswer(q.id, draft); setEditing(false); setDraft(''); }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>Save</button>
        </div>
      )}
    </div>
  );
}
