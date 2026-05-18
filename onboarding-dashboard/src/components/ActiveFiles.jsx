import { useState, useEffect, useRef } from 'react'
import { DEPARTMENTS, DEPT_THEME, AVATAR_BG, AVATAR_TX } from '../data'

function initials(n) { return n.split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }
function fmtDate(d) { if(!d) return '—'; return new Date(d+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

const DEPT_ICONS = {
  'HVAC-Service': <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="1.5"/><path d="M12 7v5l3 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  'HVAC-Install': <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="16" height="9" rx="1.5" stroke="#fff" strokeWidth="1.5"/><path d="M8 9V7a4 4 0 018 0v2" stroke="#fff" strokeWidth="1.5"/></svg>,
  'Plumbing':     <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 18V12a6 6 0 0112 0v6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="17" width="16" height="3" rx="1" fill="#fff" fillOpacity=".5"/></svg>,
  'Office/Admin': <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="1.5" stroke="#fff" strokeWidth="1.5"/><path d="M8 9h8M8 12h6M8 15h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  'Warehouse':    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 21V12l9-7 9 7v9H3z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><rect x="9" y="14" width="6" height="7" rx=".5" stroke="#fff" strokeWidth="1.5"/></svg>,
  'Sales':        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 17l5-5 4 4 5-7 4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

function DeptCabinet({ dept, employees, empPct, empPhaseLabel, onOpen, highlighted, onHighlightHandled }) {
  const [openDrawer, setOpenDrawer] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (highlighted) {
      // Scroll into view and open first populated drawer
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const firstFull = [
        employees.filter(e => e.name[0].toUpperCase() <= 'F'),
        employees.filter(e => { const c=e.name[0].toUpperCase(); return c>='G'&&c<='M' }),
        employees.filter(e => e.name[0].toUpperCase() >= 'N'),
      ].findIndex(arr => arr.length > 0)
      setOpenDrawer(firstFull >= 0 ? firstFull : employees.length > 0 ? 0 : null)
      onHighlightHandled?.()
    }
  }, [highlighted])
  const t = DEPT_THEME[dept]
  const count = employees.length

  const drawers = [
    { label:'A – F', files: employees.filter(e => e.name[0].toUpperCase() <= 'F') },
    { label:'G – M', files: employees.filter(e => { const c=e.name[0].toUpperCase(); return c>='G'&&c<='M' }) },
    { label:'N – Z', files: employees.filter(e => e.name[0].toUpperCase() >= 'N') },
  ]

  return (
    <div className="filing-cabinet" ref={ref} style={{ outline: highlighted ? '3px solid #fff' : 'none', outlineOffset: 3, borderRadius: 12, transition: 'outline .3s' }}>
      {/* Top cap */}
      <div className="cabinet-top" style={{ background: t.tab }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {DEPT_ICONS[dept]}
          <div>
            <div className="cabinet-dept-name">{dept}</div>
            <div className="cabinet-dept-count">{count} active file{count!==1?'s':''}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="cabinet-body" style={{ background: t.body, borderColor: t.stripe }}>
        {drawers.map((drw, di) => {
          const isOpen   = openDrawer === di
          const hasFiles = drw.files.length > 0
          return (
            <div key={di} className="cabinet-drawer-wrap">
              <div
                className={`cabinet-drawer ${isOpen?'open':''}`}
                style={{ background: isOpen?t.tab:t.tab+'cc', borderColor: t.tab, cursor: hasFiles?'pointer':'default', opacity: hasFiles?1:.5 }}
                onClick={() => hasFiles && setOpenDrawer(isOpen ? null : di)}
              >
                <div className="drawer-label-area" style={{ background: t.light, color: t.lightTx }}>
                  <span className="drawer-label-text">{drw.label}</span>
                </div>
                <div className="drawer-handle" style={{ background: '#fff' }} />
                <div className="drawer-count" style={{ color:'#fff' }}>{drw.files.length} file{drw.files.length!==1?'s':''}</div>
                <div className="drawer-chevron" style={{ color:'#fff' }}>{hasFiles?(isOpen?'▲':'▼'):'—'}</div>
              </div>

              {isOpen && (
                <div className="drawer-contents" style={{ borderColor: t.stripe }}>
                  {drw.files.length === 0
                    ? <div className="drawer-empty">No files in this range</div>
                    : (
                      <div className="drawer-files">
                        {drw.files.map(e => {
                          const pct = empPct(e.id)
                          const ph  = empPhaseLabel(e.id)
                          const ci  = e.colorIdx || 0
                          return (
                            <div key={e.id} className="active-file-card" onClick={() => onOpen(e.id)}>
                              <div className="afc-tab" style={{ background: t.tab }}>
                                <div style={{ width:28, height:28, borderRadius:'50%', background:AVATAR_BG[ci], color:AVATAR_TX[ci], display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                                  {initials(e.name)}
                                </div>
                                <div>
                                  <div style={{ color:'#fff', fontSize:12, fontWeight:700, lineHeight:1.2 }}>{e.name}</div>
                                  <div style={{ color:'rgba(255,255,255,.7)', fontSize:10 }}>{e.title}</div>
                                </div>
                                <span className="phase-pill" style={{ background:ph.bg, color:ph.color, marginLeft:'auto', flexShrink:0 }}>{ph.label}</span>
                              </div>
                              <div className="afc-body" style={{ borderColor: t.stripe }}>
                                <div className="afc-row"><span className="afc-lbl">Manager</span><span className="afc-val">{e.mgr||'—'}</span></div>
                                <div className="afc-row"><span className="afc-lbl">Hire date</span><span className="afc-val">{fmtDate(e.start)}</span></div>
                                <div className="afc-row"><span className="afc-lbl">Type</span><span className="afc-val">{e.type}</span></div>
                                <div style={{ borderTop:`1.5px dashed ${t.stripe}`, margin:'8px 0 6px' }} />
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                                  <span style={{ fontSize:10, color:'#888', fontWeight:600 }}>Progress</span>
                                  <span style={{ fontSize:12, fontWeight:700, color:t.tab }}>{pct}%</span>
                                </div>
                                <div className="mini-bar-wrap">
                                  <div className="mini-bar" style={{ width:`${pct}%`, background:t.tab }} />
                                </div>
                                <button className="open-file-btn" style={{ background:t.tab, color:'#fff' }} onClick={ev=>{ev.stopPropagation();onOpen(e.id)}}>
                                  Open file →
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </div>
              )}
            </div>
          )
        })}
        <div className="cabinet-base" style={{ background: t.tab+'88' }} />
      </div>
    </div>
  )
}

export default function ActiveFiles({ employees, empPct, empPhaseLabel, onOpen, onAdd, targetDept, onTargetHandled }) {
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name:'', title:'', dept:'HVAC-Service', mgr:'', start:'', type:'Full Time' })

  const filtered = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))

  function handleAdd() {
    if(!form.name.trim()) { alert('Please enter a name.'); return }
    onAdd(form)
    setForm({ name:'', title:'', dept:'HVAC-Service', mgr:'', start:'', type:'Full Time' })
    setShowForm(false)
  }

  return (
    <div>
      <div className="cabinet-header">
        <div className="cabinet-title">Active onboarding files</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input type="text" className="search-inp" placeholder="Search by name…" value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="add-btn" onClick={()=>setShowForm(v=>!v)}>+ Add new hire</button>
        </div>
      </div>

      {showForm && (
        <div className="add-form">
          <div className="af-grid">
            {[['name','Full name','text','First Last'],['title','Job title','text','e.g. HVAC Technician'],['mgr','Hiring manager','text','Manager name'],['start','Start date','date','']].map(([f,l,t,p])=>(
              <div className="af-field" key={f}><label>{l}</label><input type={t} placeholder={p} value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} /></div>
            ))}
            <div className="af-field"><label>Department</label>
              <select value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))}>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="af-field"><label>Employment type</label>
              <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                <option>Full Time</option><option>Part Time</option><option>Contract</option>
              </select>
            </div>
          </div>
          <div className="af-btns">
            <button className="af-save" onClick={handleAdd}>Save &amp; open file</button>
            <button className="af-cancel" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {employees.length === 0
        ? <div className="empty">No active files yet. Click "+ Add new hire" to get started.</div>
        : (
          <div className="filing-cabinets-row">
            {DEPARTMENTS.map(dept => (
              <DeptCabinet key={dept} dept={dept}
                employees={filtered.filter(e=>e.dept===dept)}
                empPct={empPct} empPhaseLabel={empPhaseLabel} onOpen={onOpen}
                highlighted={targetDept===dept}
                onHighlightHandled={onTargetHandled} />
            ))}
          </div>
        )
      }
    </div>
  )
}
