import { openFormFile, openPDF } from '../formOpener'
import React, { useState, useEffect } from 'react'
import { PHASES, TASKS, DEPT_SKILLS, DEPT_EVALS, DEPT_DOCS, ROLE_BADGE, DEPT_THEME } from '../data'

const PHASE_LABELS = {
  preboard:'PRE-BOARDING', day1:'DAY 1', day2_7:'WEEK 1-2',
  day8_14:'DAY 8-14', day15_45:'DAY 15-45', day46_6m:'DAY 46-6 MO',
}
const PHASE_SUBTITLES = {
  preboard:'Getting Started', day1:'First Day', day2_7:'Shadowing & Ride-Alongs',
  day8_14:'Check-Ins & KPIs', day15_45:'30-Day Review', day46_6m:'Full Immersion',
}
const EXTRA_TABS = ['overview','evaluations','skills','documents']
const EXTRA_LABELS = { overview:'OVERVIEW', evaluations:'EVALS', skills:'SKILLS', documents:'DOCUMENTS' }
const ROLE_ICONS = { 'Recruiter':'👤','Hiring Manager':'👔','Leadership':'⭐','Human Resources':'📋','Employee':'✏️' }

export default function EmployeeModal({
  employee, taskState, customTasks, skillState, evalState, customEvals, docState,
  empPct, phasePct, initialPhase, isCompleted,
  onToggleTask, onSetStatus, onSelectAll,
  onAddCustomTask, onUpdateCustomTask, onRemoveCustomTask,
  onToggleSkill, onSetEval, onSetEvalNote,
  onAddCustomEval, onUpdateCustomEval, onRemoveCustomEval,
  onToggleDoc, onUpdateEmp, onSignOff, onClose,
  formData, onSaveFormData,
}) {
  const allTabs = [...PHASES.map(p => p.id), ...EXTRA_TABS]
  const [activeTab, setActiveTab] = useState(initialPhase || 'preboard')
  useEffect(() => { if (initialPhase) setActiveTab(initialPhase) }, [initialPhase])

  if (!employee) return null
  const pct = empPct(employee.id)
  const dept = employee.dept || 'HVAC-Service'
  const dt = DEPT_THEME[dept] || DEPT_THEME['HVAC-Service']
  const idx = allTabs.indexOf(activeTab)
  const isPhaseTab = PHASES.some(p => p.id === activeTab)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* ══ LEFT COVER ══ */}
        <div className="binder-cover" style={{ background: `linear-gradient(155deg, ${dt.tab} 0%, ${dt.tab}cc 100%)` }}>
          <div className="binder-spine" />

          {/* Top sticky note */}
          <div className="sticky-note">
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 13, color: '#3a2e10', lineHeight: 1.5 }}>
              {isCompleted ? '🎓 Graduated!' : 'Welcome to\nthe team!'}
            </span>
            <div style={{ marginTop: 4, color: '#9a7a20', fontSize: 11 }}>❄</div>
          </div>

          {/* Brand badge — matches actual logo */}
          <div className="cover-badge">
            <div className="badge-sunburst" />
            <div className="badge-top">Air Conditioning</div>
            <div className="badge-christmas">Christmas</div>
            <div className="badge-divider" />
            <div className="badge-bottom">And Plumbing</div>
            <div className="badge-arrows">← ——— →</div>
          </div>

          {/* File label */}
          <div className="cover-label">
            <div className="cover-label-top">New Hire Onboarding</div>
            <div className="cover-label-bot">Employee Resource Guide</div>
          </div>

          {/* Employee info */}
          <div className="cover-emp-area">
            <div className="cover-emp-name">{employee.name}</div>
            <div className="cover-emp-dept">{dept} · {employee.title}</div>
            {/* SVG progress ring */}
            <div style={{ margin: '8px auto 0', width: 70, height: 70 }}>
              <svg width="70" height="70" viewBox="0 0 70 70">
                <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
                <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 28 * pct / 100} ${2 * Math.PI * 28 * (1 - pct / 100)}`}
                  strokeDashoffset={2 * Math.PI * 28 * 0.25}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray .5s' }} />
                <text x="35" y="40" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">{pct}%</text>
              </svg>
            </div>
            {isCompleted && (
              <div style={{ marginTop: 8, background: 'rgba(255,215,0,.2)', border: '1.5px solid rgba(255,215,0,.45)', borderRadius: 8, padding: '5px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#ffd700' }}>★ Graduated</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.65)', marginTop: 1 }}>{employee.completedDate}</div>
              </div>
            )}
          </div>

          <div className="cover-tagline">Building Comfort. Delivering Joy.</div>

          {/* Bottom sticky */}
          <div className="sticky-note" style={{ top: 'auto', bottom: -14, left: 14, transform: 'rotate(2deg)' }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 12, color: '#3a2e10', lineHeight: 1.5 }}>We're glad<br />you're here! :)</span>
          </div>
        </div>

        {/* ══ RIGHT PAGES ══ */}
        <div className="binder-pages">
          {/* Phase tabs */}
          <div className="binder-tabs">
            {PHASES.map(p => (
              <button key={p.id} className={`binder-tab ${activeTab === p.id ? 'active' : ''}`}
                style={activeTab === p.id ? { borderTop: `3px solid ${dt.tab}` } : {}}
                onClick={() => setActiveTab(p.id)}>
                {PHASE_LABELS[p.id]}
              </button>
            ))}
            {EXTRA_TABS.map(t => (
              <button key={t} className={`binder-tab ${activeTab === t ? 'active' : ''}`}
                style={activeTab === t ? { borderTop: `3px solid ${dt.tab}` } : {}}
                onClick={() => setActiveTab(t)}>
                {EXTRA_LABELS[t]}
              </button>
            ))}
            <button className="binder-close" onClick={onClose}>✕</button>
          </div>

          {/* Page content */}
          <div className="binder-content">
            <div className="page-header">
              <div className="page-header-left">
                <div className="page-mini-badge">
                  <div style={{ fontSize: 7, fontWeight: 900, color: dt.tab, letterSpacing: '.12em', textTransform: 'uppercase' }}>Air Conditioning</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#8b2635', fontStyle: 'italic', fontFamily: 'Georgia,serif', lineHeight: 1 }}>Christmas</div>
                  <div style={{ fontSize: 7, fontWeight: 900, color: dt.tab, letterSpacing: '.1em', textTransform: 'uppercase' }}>And Plumbing</div>
                </div>
                <div>
                  <div className="page-title">{isPhaseTab ? PHASE_LABELS[activeTab] : EXTRA_LABELS[activeTab]}</div>
                  <div className="page-subtitle">{isPhaseTab ? PHASE_SUBTITLES[activeTab] : `${dept} · ${employee.title}`}</div>
                </div>
              </div>
              <div className="page-snowflake">❄</div>
            </div>

            <div className="welcome-line">
              Welcome! We're excited to have you join the <strong style={{ color: dt.tab }}>Christmas Air Conditioning &amp; Plumbing</strong> team.
            </div>

            {isPhaseTab && <PhaseTab employee={employee} phaseId={activeTab} taskState={taskState} customTasks={customTasks} phasePct={phasePct} onToggle={onToggleTask} onSetStatus={onSetStatus} onSelectAll={onSelectAll} onAddCustom={onAddCustomTask} onUpdateCustom={onUpdateCustomTask} onRemoveCustom={onRemoveCustomTask} dt={dt} />}
            {activeTab === 'overview' && <OverviewTab employee={employee} phasePct={phasePct} onUpdate={onUpdateEmp} onSignOff={onSignOff} isCompleted={isCompleted} dt={dt} onClickPhase={setActiveTab} />}
            {activeTab === 'evaluations' && <EvaluationsTab employee={employee} evalState={evalState} customEvals={customEvals} onSetEval={onSetEval} onSetNote={onSetEvalNote} onAddCustom={onAddCustomEval} onUpdateCustom={onUpdateCustomEval} onRemoveCustom={onRemoveCustomEval} />}
            {activeTab === 'skills' && <SkillsTab employee={employee} skillState={skillState} onToggle={onToggleSkill} dt={dt} />}
            {activeTab === 'documents' && <DocumentsTab employee={employee} docState={docState} onToggle={onToggleDoc} />}
          </div>

          {/* Bottom nav */}
          <div className="binder-nav">
            <button className="binder-nav-btn" onClick={() => { const n = idx - 1; if (n >= 0) setActiveTab(allTabs[n]) }} disabled={idx === 0}>← Prev page</button>
            <div className="binder-nav-page">{idx + 1} of {allTabs.length}</div>
            <button className="binder-nav-btn" onClick={() => { const n = idx + 1; if (n < allTabs.length) setActiveTab(allTabs[n]) }} disabled={idx === allTabs.length - 1}>Next page →</button>
          </div>
          <div className="binder-footer">❄ &nbsp; Building Comfort. Delivering Joy.</div>
        </div>
      </div>
    </div>
  )
}

function PhaseTab({ employee, phaseId, taskState, customTasks, phasePct, onToggle, onSetStatus, onSelectAll, onAddCustom, onUpdateCustom, onRemoveCustom, dt }) {
  const id = employee.id
  const pp = phasePct(id, phaseId)
  const phaseCustom = customTasks[phaseId] || {}

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
          <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Phase completion</span>
          <span style={{ fontWeight: 800, color: dt.tab }}>{pp}%</span>
        </div>
        <div style={{ background: 'var(--parch)', borderRadius: 4, height: 7, overflow: 'hidden' }}>
          <div style={{ height: 7, borderRadius: 4, background: dt.tab, width: `${pp}%`, transition: 'width .35s' }} />
        </div>
      </div>

      {Object.keys(TASKS[phaseId]).map(role => {
        const badge = ROLE_BADGE[role] || 'bhm'
        const customArr = phaseCustom[role] || []
        const allDone = TASKS[phaseId][role].every((_, ti) => taskState[`${phaseId}_${role}_${ti}`] === 'Done') && customArr.every(t => t.done)
        const icon = ROLE_ICONS[role] || '📌'
        return (
          <div key={role} className="tsec">
            <div className="tsec-header">
              <span className={`rbadge ${badge}`}>{icon} {role}</span>
              <button className="select-all-btn" onClick={() => onSelectAll(id, phaseId, role, allDone ? 'Not Started' : 'Done')}>
                {allDone ? 'Uncheck all' : 'Check all'}
              </button>
            </div>
            <div className="section-box">
              <div className="section-header">In this section — {TASKS[phaseId][role].length + customArr.length} items</div>
              {TASKS[phaseId][role].map((task, ti) => {
                const k = `${phaseId}_${role}_${ti}`
                const s = taskState[k] || 'Not Started'
                const done = s === 'Done'
                return (
                  <div key={ti} className={`section-row ${done ? 'row-done' : ''}`} onClick={() => onToggle(id, k)}>
                    <div className="row-check on" style={{ background: done ? 'var(--green)' : 'var(--paper)', borderColor: done ? 'var(--green)' : 'var(--tan)' }}>
                      {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5 4,7.5 8.5,2" /></svg>}
                    </div>
                    <div className="row-icon" style={{ background: dt.tab, color: '#fff' }}>{icon}</div>
                    <span className="row-label">{task}</span>
                    <span className="row-type">{s === 'Done' ? 'DONE' : s === 'In Progress' ? 'IN PROG' : s === 'N/A' ? 'N/A' : ''}</span>
                    <select className="task-sel" value={s} onClick={e => e.stopPropagation()} onChange={e => onSetStatus(id, k, e.target.value)}>
                      <option>Not Started</option><option>In Progress</option><option>Done</option><option>N/A</option>
                    </select>
                    <button className="row-open-btn" onClick={e => { e.stopPropagation(); onToggle(id, k) }}>
                      {done ? '✓ Done' : 'OPEN ↗'}
                    </button>
                  </div>
                )
              })}
              {customArr.map((ct, ci2) => (
                <div key={ci2} className="custom-row">
                  <div className="row-check" style={{ background: ct.done ? 'var(--green)' : 'var(--paper)', borderColor: ct.done ? 'var(--green)' : 'var(--tan)', cursor: 'pointer' }}
                    onClick={() => onUpdateCustom(id, phaseId, role, ci2, 'done', !ct.done)}>
                    {ct.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5 4,7.5 8.5,2" /></svg>}
                  </div>
                  <input className="custom-inp" placeholder="Custom task…" value={ct.text} onChange={e => onUpdateCustom(id, phaseId, role, ci2, 'text', e.target.value)} />
                  <button className="custom-del" onClick={() => onRemoveCustom(id, phaseId, role, ci2)}>✕</button>
                </div>
              ))}
            </div>
            <button className="add-custom-btn" onClick={() => onAddCustom(id, phaseId, role)}>+ Add custom task</button>
          </div>
        )
      })}
    </div>
  )
}

function OverviewTab({ employee, phasePct, onUpdate, onSignOff, isCompleted, dt, onClickPhase }) {
  const [confirm, setConfirm] = React.useState(false)
  const phaseLabels = { preboard: 'Pre-Boarding', day1: 'Day 1', day2_7: 'Week 1-2', day8_14: 'Day 8-14', day15_45: 'Day 15-45', day46_6m: 'Day 46-6 Mo' }
  return (
    <div>
      <div className="info-grid">
        {[['name', 'Full name'], ['title', 'Job title'], ['dept', 'Department'], ['mgr', 'Hiring manager'], ['start', 'Start date'], ['type', 'Employment type']].map(([f, l]) => (
          <div className="if" key={f}>
            <label>{l}</label>
            <input type={f === 'start' ? 'date' : 'text'} defaultValue={employee[f]} onBlur={e => onUpdate(employee.id, f, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="section-box" style={{ marginBottom: 14 }}>
        <div className="section-header">Phase progress — click any bar to open that section</div>
        <div style={{ padding: '12px 14px', background: 'var(--paper)' }}>
          {PHASES.map(p => {
            const pp = phasePct(employee.id, p.id)
            return (
              <div key={p.id} style={{ marginBottom: 9, cursor: 'pointer' }} onClick={() => onClickPhase(p.id)}>
                <div className="phase-progress-row">
                  <span className="ppr-label">{phaseLabels[p.id]}</span>
                  <span className="ppr-pct">{pp}%</span>
                </div>
                <div className="phase-bar-wrap">
                  <div className="phase-bar-fill" style={{ width: `${pp}%`, background: dt.tab }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {isCompleted ? (
        <div className="signoff-box" style={{ background: '#fff8e1', borderColor: '#f0c040' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#5c3a00' }}>★ Employee Graduated</div>
            <div style={{ fontSize: 11, color: '#8a5610', marginTop: 1 }}>Completed {employee.completedDate} · File archived.</div>
          </div>
        </div>
      ) : (
        <div className="signoff-box">
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--green-dk)' }}>1-Year Sign-Off</div>
            <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 1 }}>Graduate once all tasks and the 1-year review are complete.</div>
          </div>
          {!confirm
            ? <button className="signoff-btn" onClick={() => setConfirm(true)}>Complete &amp; File</button>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-dk)' }}>Are you sure?</span>
              <button className="signoff-btn" onClick={() => { onSignOff(employee.id); setConfirm(false) }}>Yes, Graduate</button>
              <button className="signoff-btn" style={{ background: 'var(--muted)' }} onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          }
        </div>
      )}
    </div>
  )
}

function EvaluationsTab({ employee, evalState, customEvals, onSetEval, onSetNote, onAddCustom, onUpdateCustom, onRemoveCustom }) {
  const dept = employee.dept || 'HVAC-Service'
  const evals = DEPT_EVALS[dept] || DEPT_EVALS['HVAC-Service']
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Score each area 0–10. Add custom criteria per review.</p>
      {evals.map(ev => {
        const es = evalState[ev.id] || {}; const ca = customEvals[ev.id] || []
        const scores = [...ev.skills.map(sk => es[sk] || 0), ...ca.map(c => c.score || 0)]
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0
        return (
          <div className="eval-card" key={ev.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="eval-title">{ev.title}</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>{avg}/10</span>
            </div>
            {ev.skills.map(sk => { const v = es[sk] || 0; return (
              <div className="eval-row" key={sk}>
                <div className="elabel">{sk}</div>
                <div className="ebar-bg"><div className="ebar-fill" style={{ width: `${v * 10}%` }} /></div>
                <input className="einp" type="number" min="0" max="10" step="1" defaultValue={v} onBlur={e => onSetEval(employee.id, ev.id, sk, e.target.value)} />
              </div>
            ) })}
            {ca.map((ce, ci) => (
              <div key={ci} className="custom-eval-row">
                <input className="custom-eval-inp" placeholder="Custom criteria…" value={ce.label} onChange={e => onUpdateCustom(employee.id, ev.id, ci, 'label', e.target.value)} />
                <div className="ebar-bg"><div className="ebar-fill" style={{ width: `${(ce.score || 0) * 10}%` }} /></div>
                <input className="einp" type="number" min="0" max="10" value={ce.score || 0} onChange={e => onUpdateCustom(employee.id, ev.id, ci, 'score', Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))} />
                <button className="custom-del" style={{ marginLeft: 4 }} onClick={() => onRemoveCustom(employee.id, ev.id, ci)}>✕</button>
              </div>
            ))}
            <button className="add-custom-btn" onClick={() => onAddCustom(employee.id, ev.id)}>+ Add custom line</button>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 9.5, color: 'var(--muted)', display: 'block', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Manager notes</label>
              <textarea style={{ width: '100%', fontSize: 11, padding: '6px 8px', border: '1.5px solid var(--tan)', borderRadius: 5, background: 'var(--paper)', color: 'var(--text)', resize: 'vertical', minHeight: 48, fontFamily: 'inherit', outline: 'none' }}
                defaultValue={es._note || ''} onBlur={e => onSetNote(employee.id, ev.id, e.target.value)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SkillsTab({ employee, skillState, onToggle, dt }) {
  const dept = employee.dept || 'HVAC-Service'
  const skills = DEPT_SKILLS[dept] || DEPT_SKILLS['HVAC-Service']
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Click any skill to sign off. Skills are tailored to {dept}.</p>
      {skills.map((lvl, li) => {
        const done = lvl.items.filter((_, ii) => skillState[`${li}_${ii}`]).length
        return (
          <div className="eval-card" key={li}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="eval-title">{lvl.name}</div>
              <span style={{ fontSize: 11, fontWeight: 800, color: dt.tab }}>{done}/{lvl.items.length} signed off</span>
            </div>
            <div className="skill-grid">
              {lvl.items.map((item, ii) => {
                const on = skillState[`${li}_${ii}`]
                return (
                  <div key={ii} className={`skill-item ${on ? 'skill-on' : ''}`} onClick={() => onToggle(employee.id, li, ii)}>
                    <div className="skill-name">{item}</div>
                    <div className="skill-status" style={{ color: on ? dt.tab : 'var(--tan-dk)' }}>{on ? '✓ Signed off' : 'Pending'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DocumentsTab({ employee, docState, onToggle }) {
  const dept = employee.dept || 'HVAC-Service'
  const docs = DEPT_DOCS[dept] || []
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Documents for <strong>{dept}</strong>. Check off when received. Forms open in a new tab to fill out or print.</p>
      {docs.length === 0 && (
        <div style={{ background: 'var(--cream)', border: '1px dashed var(--tan)', borderRadius: 8, padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No documents configured yet — they'll be added as they become available.
        </div>
      )}
      <div className="section-box">
        {docs.length > 0 && <div className="section-header">In this section — {docs.length} item{docs.length !== 1 ? 's' : ''}</div>}
        {docs.map(doc => {
          const checked = docState[doc.id]
          const isForm = doc.type === 'form' && doc.formFile
          return (
            <div key={doc.id} className={`section-row ${checked ? 'row-done' : ''}`}>
              <div className="row-check" style={{ background: checked ? 'var(--green)' : 'var(--paper)', borderColor: checked ? 'var(--green)' : 'var(--tan)', cursor: 'pointer' }}
                onClick={() => onToggle(employee.id, doc.id)}>
                {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5 4,7.5 8.5,2" /></svg>}
              </div>
              <div className="row-icon" style={{ background: checked ? 'var(--green)' : 'var(--tan-dk)', color: '#fff', fontSize: 14 }}>{isForm ? '📝' : '📄'}</div>
              <span className="row-label">{doc.name}</span>
              <span className="row-type">{isForm ? 'FORM' : 'PDF'}</span>
              {isForm
                ? <button className="row-open-btn" onClick={() => openFormFile(doc.formFile)}>OPEN ↗</button>
                : <button className="row-open-btn" style={{ background: 'var(--tan-dk)', cursor: 'default' }}>Coming soon</button>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}
