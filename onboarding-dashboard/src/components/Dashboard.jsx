import { useEffect, useRef, useState } from 'react'
import { openFormFile } from '../formOpener'
import { Chart, registerables } from 'chart.js'
import { PHASES, DEPT_THEME, DEPARTMENTS, FORM_FOLDERS, AVATAR_BG, AVATAR_TX } from '../data'

Chart.register(...registerables)

function getEvents(employees) {
  const evs = []
  employees.forEach(e => {
    if(!e.start) return
    const s = new Date(e.start+'T00:00')
    const add = (label, color, days) => {
      const d = new Date(s); d.setDate(d.getDate()+days)
      evs.push({ date:d, label:`${e.name.split(' ')[0]} — ${label}`, fullName:e.name, empId:e.id, color })
    }
    add('Start date',      '#4e7c5f', 0)
    add('30-day review',   '#2f5240', 30)
    add('45-day check-in', '#9a8a3a', 45)
    add('60-day check-in', '#6b8a7a', 60)
    add('6-month review',  '#4e7c5f', 180)
    add('1-year review',   '#2f5240', 365)
  })
  return evs.sort((a,b)=>a.date-b.date)
}

function FormModal({ form, onClose }) {
  const [vals, setVals] = useState({})
  const set = (id,v) => setVals(p=>({...p,[id]:v}))

  if(form.file) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal fm-modal" onClick={e=>e.stopPropagation()}>
          <div style={{background:'var(--green-dk)',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--cream)'}}>{form.name}</div>
              <div style={{fontSize:11,color:'rgba(240,234,216,.6)',marginTop:1}}>{form.desc}</div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="add-btn" onClick={()=>openFormFile(form.file)}>Open &amp; Print Form ↗</button>
              <button className="af-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
          <div style={{padding:'1.5rem',textAlign:'center',background:'var(--cream)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📄</div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:6,color:'var(--text)'}}>{form.name}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>{form.desc}</div>
            <button className="add-btn" onClick={()=>openFormFile(form.file)}>Open &amp; Print Form ↗</button>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:10}}>Opens in a new tab — fill out online or print as PDF</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fm-modal" onClick={e=>e.stopPropagation()}>
        <div style={{background:'var(--green-dk)',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:16,fontWeight:700,color:'var(--cream)'}}>{form.name}</div>
          <button className="af-cancel" onClick={onClose} style={{background:'rgba(255,255,255,.15)',color:'var(--cream)',border:'none'}}>Close</button>
        </div>
        <div style={{padding:'1rem 1.25rem 1.5rem',background:'var(--paper)'}}>
          <div className="fm-grid">
            {(form.fields||[]).map(f=>(
              <div key={f.id} className={`fm-field ${f.type==='textarea'?'fm-full':''}`}>
                {f.type==='check'
                  ? <label className="fm-check-row"><input type="checkbox" checked={!!vals[f.id]} onChange={e=>set(f.id,e.target.checked)}/><span>{f.label}</span></label>
                  : f.type==='textarea'
                  ? <><label className="fm-label">{f.label}</label><textarea className="fm-textarea" value={vals[f.id]||''} onChange={e=>set(f.id,e.target.value)} rows={3}/></>
                  : <><label className="fm-label">{f.label}</label><input className="fm-input" type={f.type} value={vals[f.id]||''} onChange={e=>set(f.id,e.target.value)}/></>
                }
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}>
            <button className="add-btn" onClick={()=>alert('Saved! (connect to backend to persist)')}>Save form</button>
            <button className="af-cancel" onClick={()=>window.print()}>Print / Download</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarSection({ employees, onOpenEmployee }) {
  const [view, setView] = useState(new Date())
  const evs = getEvents(employees)
  const yr=view.getFullYear(), mo=view.getMonth()
  const firstDow=new Date(yr,mo,1).getDay()
  const daysInMo=new Date(yr,mo+1,0).getDate()
  const weeks=Math.ceil((firstDow+daysInMo)/7)
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayEvs={}
  evs.forEach(ev=>{ if(ev.date.getFullYear()===yr&&ev.date.getMonth()===mo){const d=ev.date.getDate();if(!dayEvs[d])dayEvs[d]=[];dayEvs[d].push(ev)} })
  const now=new Date();now.setHours(0,0,0,0)
  const soon=new Date(now);soon.setDate(now.getDate()+60)
  const upcoming=evs.filter(ev=>ev.date>=now&&ev.date<=soon)

  return (
    <div className="cal-wrap">
      <div className="chart-card" style={{flex:'1 1 340px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <button className="cal-nav" onClick={()=>setView(new Date(yr,mo-1,1))}>‹</button>
          <span style={{fontWeight:700,fontSize:13,color:'var(--green-dk)'}}>{MONTHS[mo]} {yr}</span>
          <button className="cal-nav" onClick={()=>setView(new Date(yr,mo+1,1))}>›</button>
        </div>
        <div className="cal-grid">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} className="cal-dow">{d}</div>)}
          {Array.from({length:weeks*7}).map((_,i)=>{
            const day=i-firstDow+1
            const valid=day>=1&&day<=daysInMo
            const isToday=valid&&new Date(yr,mo,day).toDateString()===new Date().toDateString()
            const evList=dayEvs[day]||[]
            return (
              <div key={i} className={`cal-cell ${valid?'cal-valid':''} ${isToday?'cal-today':''}`}>
                {valid&&<span className="cal-day-num">{day}</span>}
                {evList.slice(0,2).map((ev,ei)=>(
                  <div key={ei} className="cal-event" style={{background:ev.color,cursor:'pointer'}}
                    onClick={()=>ev.empId&&onOpenEmployee(ev.empId)}
                    title={ev.label}>
                    <span className="cal-event-txt">{ev.label.split('—')[0].trim()}</span>
                  </div>
                ))}
                {evList.length>2&&<div className="cal-more">+{evList.length-2}</div>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="chart-card" style={{flex:'1 1 220px',minWidth:0}}>
        <div className="chart-title">Upcoming — next 60 days</div>
        {upcoming.length===0
          ? <div style={{fontSize:12,color:'var(--muted)',paddingTop:8}}>No events in the next 60 days.</div>
          : upcoming.map((ev,i)=>(
            <div key={i} className="upcoming-row" style={{cursor:ev.empId?'pointer':'default'}}
              onClick={()=>ev.empId&&onOpenEmployee(ev.empId)}>
              <div className="upcoming-dot" style={{background:ev.color}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text)'}}>{ev.label}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>{ev.date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
              </div>
              <span style={{fontSize:9,color:'var(--green)',fontWeight:700,flexShrink:0}}>→ File</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

function FormFolders() {
  const [openFolder, setOpenFolder] = useState(null)
  const [openForm,   setOpenForm]   = useState(null)

  return (
    <>
      {openForm && <FormModal form={openForm} onClose={()=>setOpenForm(null)}/>}
      <div className="form-folders-grid">
        {FORM_FOLDERS.map(ff=>(
          <div key={ff.id} className="form-folder-card" style={{ borderColor: openFolder===ff.id ? ff.color : undefined }}
            onClick={()=>setOpenFolder(openFolder===ff.id?null:ff.id)}>
            <div className="ffc-tab" style={{ background:ff.color, color:'#fff' }}>
              <span className="ffc-icon">{ff.icon}</span>
              <div>
                <div className="ffc-name">{ff.name}</div>
                <div className="ffc-count">{ff.forms.length} form{ff.forms.length!==1?'s':''} · {Array.isArray(ff.dept)?ff.dept.join(', '):ff.dept}</div>
              </div>
              <div style={{marginLeft:'auto',color:'rgba(255,255,255,.7)',fontSize:12}}>{openFolder===ff.id?'▲':'▼'}</div>
            </div>
            {openFolder===ff.id && (
              <div className="ffc-body" onClick={e=>e.stopPropagation()}>
                {ff.forms.map(f=>(
                  <div key={f.id} className="ffc-form-item" onClick={()=>setOpenForm(f)}>
                    <span style={{fontSize:16}}>📄</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:12}}>{f.name}</div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{f.desc}</div>
                    </div>
                    <span style={{marginLeft:'auto',fontSize:10,color:ff.color,fontWeight:700}}>Open →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default function Dashboard({ employees, completedEmployees, taskState, skillState, empPct, onGoToDept, onOpenEmployee }) {
  const statusRef=useRef(null), phaseRef=useRef(null)
  const charts=useRef({})
  const year=new Date().getFullYear()
  const total=employees.length+completedEmployees.length
  const avgPct=employees.length?Math.round(employees.reduce((s,e)=>s+empPct(e.id),0)/employees.length):0

  function destroy(k){if(charts.current[k]){try{charts.current[k].destroy()}catch(e){}charts.current[k]=null}}

  useEffect(()=>{
    let ns=0,ip=0,dn=0
    employees.forEach(e=>Object.values(taskState[e.id]||{}).forEach(s=>{if(s==='Done')dn++;else if(s==='In Progress')ip++;else ns++}))
    destroy('status')
    if(!statusRef.current)return
    charts.current.status=new Chart(statusRef.current,{type:'doughnut',data:{labels:['Done','In progress','Not started'],datasets:[{data:[dn,ip,ns],backgroundColor:['#4e7c5f','#9a8a3a','#c8bc9a'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}})
  },[employees,taskState])

  useEffect(()=>{
    destroy('phase')
    if(!employees.length||!phaseRef.current)return
    charts.current.phase=new Chart(phaseRef.current,{type:'bar',data:{labels:employees.map(e=>e.name.split(' ')[0]),datasets:[{label:'% complete',data:employees.map(e=>empPct(e.id)),backgroundColor:employees.map(e=>DEPT_THEME[e.dept]?.tab||'#888'),borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(128,128,128,0.1)'}},y:{ticks:{font:{size:11}}}}}})
  },[employees,empPct])

  useEffect(()=>()=>Object.values(charts.current).forEach(c=>c?.destroy()),[])

  let ns=0,ip=0,dn=0
  employees.forEach(e=>Object.values(taskState[e.id]||{}).forEach(s=>{if(s==='Done')dn++;else if(s==='In Progress')ip++;else ns++}))
  const phaseH=Math.max(employees.length*44+60,120)

  return (
    <div>
      {/* Stats */}
      <div className="stat-row">
        <div className="stat"><div className="stat-n" style={{color:'var(--green)'}}>{total}</div><div className="stat-l">Total hires {year}</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--green-dk)'}}>{employees.length}</div><div className="stat-l">Active</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--green)'}}>{completedEmployees.length}</div><div className="stat-l">Completed</div></div>
        <div className="stat"><div className="stat-n">{avgPct}%</div><div className="stat-l">Avg progress</div></div>
      </div>

      {/* Dept pills — clickable → go to that cabinet */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {DEPARTMENTS.map(d=>{
          const t=DEPT_THEME[d]
          const cnt=employees.filter(e=>e.dept===d).length
          return (
            <button key={d}
              onClick={()=>onGoToDept(d)}
              style={{background:t.light,color:t.lightTx,borderRadius:8,padding:'6px 13px',fontSize:12,fontWeight:700,
                display:'flex',alignItems:'center',gap:6,border:`1.5px solid ${t.stripe}`,
                cursor:'pointer',transition:'all .15s',outline:'none',
                boxShadow:'0 1px 3px rgba(60,40,10,.1)'}}
              onMouseOver={e=>{e.currentTarget.style.background=t.tab;e.currentTarget.style.color='#fff'}}
              onMouseOut={e=>{e.currentTarget.style.background=t.light;e.currentTarget.style.color=t.lightTx}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:t.tab,display:'inline-block',flexShrink:0}}/>
              {d} — {cnt}
              <span style={{fontSize:9,opacity:.65,marginLeft:2}}>↗</span>
            </button>
          )
        })}
      </div>

      {/* Charts */}
      <div className="charts-row" style={{marginBottom:'1.25rem'}}>
        <div className="chart-card">
          <div className="chart-title">Task status — all active</div>
          <div className="legend">
            <span className="legend-item"><span className="legend-dot" style={{background:'#4e7c5f'}}/>Done ({dn})</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#9a8a3a'}}/>In progress ({ip})</span>
            <span className="legend-item"><span className="legend-dot" style={{background:'#c8bc9a'}}/>Not started ({ns})</span>
          </div>
          <div style={{position:'relative',height:200}}><canvas ref={statusRef} aria-label="Task status chart"/></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Progress by hire</div>
          <div style={{position:'relative',height:phaseH}}><canvas ref={phaseRef} aria-label="Progress by hire chart"/></div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:13,fontWeight:800,color:'var(--green-dk)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.04em'}}>Onboarding Calendar</div>
        <CalendarSection employees={[...employees,...completedEmployees]} onOpenEmployee={onOpenEmployee}/>
      </div>

      {/* Forms */}
      <div style={{fontSize:13,fontWeight:800,color:'var(--green-dk)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.04em'}}>Forms</div>
      <FormFolders/>
    </div>
  )
}
