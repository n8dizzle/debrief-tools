import { useState } from 'react'
import { AVATAR_BG, AVATAR_TX } from '../data'

function initials(n) { return n.split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2) }
function fmtDate(d) { if(!d) return '—'; return new Date(d+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

const T = { tab:'#2c5f2e', tabDk:'#1a3d1b', body:'#e8f5e9', stripe:'#81c784', light:'#e8f5e9', lightTx:'#1a3d1b' }
const DRAWERS = [
  { label:'A – F', test: n => n[0].toUpperCase() <= 'F' },
  { label:'G – M', test: n => { const c=n[0].toUpperCase(); return c>='G'&&c<='M' } },
  { label:'N – Z', test: n => n[0].toUpperCase() >= 'N' },
]

export default function CompletedFiles({ completedEmployees, onOpenEmployee }) {
  const [openDrawer, setOpenDrawer] = useState(null)
  const total = completedEmployees.length
  const drawers = DRAWERS.map(d => ({ ...d, files: completedEmployees.filter(e=>d.test(e.name)) }))

  return (
    <div>
      <div className="cabinet-header">
        <div className="cabinet-title">Completed files — graduated employees</div>
        <span style={{ fontSize:12, color:'#888', fontWeight:600 }}>{total} employee{total!==1?'s':''} graduated</span>
      </div>

      {total === 0 && (
        <div style={{ background:T.body, border:`1.5px dashed ${T.stripe}`, borderRadius:10, padding:'2rem', textAlign:'center', fontSize:13, color:'#888', marginBottom:'1.5rem' }}>
          No completed files yet — employees appear here after their 1-year sign-off.
        </div>
      )}

      <div style={{ maxWidth:520 }}>
        <div className="filing-cabinet">
          <div className="cabinet-top" style={{ background:T.tabDk }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 24V13l10-8 10 8v11H4z" stroke="#e8f5e9" strokeWidth="1.5" strokeLinejoin="round"/><rect x="10" y="16" width="8" height="8" rx=".5" stroke="#e8f5e9" strokeWidth="1.5"/></svg>
              <div>
                <div className="cabinet-dept-name">Graduated Employees</div>
                <div className="cabinet-dept-count">{total} file{total!==1?'s':''} archived</div>
              </div>
            </div>
            <div style={{ background:'#f0c040', color:'#5c3a00', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700 }}>★ Completed</div>
          </div>

          <div className="cabinet-body" style={{ background:T.body, borderColor:T.stripe }}>
            {drawers.map((drw,di) => {
              const isOpen = openDrawer === di
              const hasFiles = drw.files.length > 0
              return (
                <div key={di} className="cabinet-drawer-wrap">
                  <div className={`cabinet-drawer ${isOpen?'open':''}`}
                    style={{ background:isOpen?T.tab:T.tab+'cc', borderColor:T.tab, cursor:hasFiles?'pointer':'default', opacity:hasFiles?1:.5 }}
                    onClick={()=>hasFiles&&setOpenDrawer(isOpen?null:di)}>
                    <div className="drawer-label-area" style={{ background:T.light, color:T.lightTx }}><span className="drawer-label-text">{drw.label}</span></div>
                    <div className="drawer-handle" style={{ background:'#fff' }} />
                    <div className="drawer-count" style={{ color:'#fff' }}>{drw.files.length} file{drw.files.length!==1?'s':''}</div>
                    <div className="drawer-chevron" style={{ color:'#fff' }}>{hasFiles?(isOpen?'▲':'▼'):'—'}</div>
                  </div>

                  {isOpen && (
                    <div className="drawer-contents" style={{ borderColor:T.stripe }}>
                      <div className="drawer-files">
                        {drw.files.map(e => {
                          const ci = e.colorIdx||0
                          return (
                            <div key={e.id} style={{ borderRadius:6, overflow:'hidden', border:'1.5px solid #c8e6c9', background:'#fff' }}>
                              {/* Tab */}
                              <div style={{ background:T.tab, padding:'7px 10px', display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:28, height:28, borderRadius:'50%', background:AVATAR_BG[ci], color:AVATAR_TX[ci], display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                                  {initials(e.name)}
                                </div>
                                <div style={{ flex:1 }}>
                                  <div style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{e.name}</div>
                                  <div style={{ color:'rgba(255,255,255,.7)', fontSize:10 }}>{e.title} · {e.dept}</div>
                                </div>
                                <span style={{ background:'#f0c040', color:'#5c3a00', borderRadius:8, padding:'1px 7px', fontSize:10, fontWeight:700, flexShrink:0 }}>✓ Graduated</span>
                              </div>
                              {/* Body */}
                              <div style={{ padding:'10px' }}>
                                <div className="afc-row"><span className="afc-lbl">Manager</span><span className="afc-val">{e.mgr||'—'}</span></div>
                                <div className="afc-row"><span className="afc-lbl">Hire date</span><span className="afc-val">{fmtDate(e.start)}</span></div>
                                <div className="afc-row"><span className="afc-lbl">Completed</span><span className="afc-val" style={{ color:'#1a5c35', fontWeight:700 }}>{e.completedDate||'—'}</span></div>
                                <button
                                  className="open-file-btn"
                                  style={{ background:T.tab, color:'#fff', marginTop:8 }}
                                  onClick={() => onOpenEmployee(e.id)}
                                >
                                  View file →
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="cabinet-base" style={{ background:T.tabDk }} />
          </div>
        </div>
      </div>
    </div>
  )
}
