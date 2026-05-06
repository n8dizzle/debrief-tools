import { useState } from 'react'
import { openPDF } from '../pdfOpener'
import { DEPARTMENTS, DEPT_THEME } from '../data'

// ─── Company-wide resources ───────────────────────────────────────────────────
const COMPANY_RESOURCES = [
  {
    id:'christmas-way-guide', icon:'📖',
    name:'The Christmas Way — Guide to Success',
    desc:'Day 1 slideshow: company mission, values, service call procedures, Service Titan forms, and more. Shown to every new hire on their first day.',
    pdfKey:'christmas_way_guide', embedded:true,
    tag:'Day 1 Presentation',
  },
  {
    id:'employee-recognition', icon:'⭐',
    name:'Employee Recognition Program — Jingle Bills',
    desc:'How the Jingle Bills program works, how employees earn them, and the full reward redemption catalog ($10–$150).',
    pdfKey:'employee_recognition', embedded:true,
    tag:'Recognition Program',
  },
  {
    id:'review-30day', icon:'💬',
    name:'30-Day Review — Discussion Questions',
    desc:'Universal 30-day check-in guide for all new hires: onboarding feedback, role fit, team integration, and 60/90-day goals.',
    pdfKey:null, embedded:false, tag:'All Departments', type:'review30',
  },
  { id:'handbook',  icon:'📋', name:'Employee Handbook',         desc:'Company policies, code of conduct, and culture guide', type:'coming' },
  { id:'insurance', icon:'🏥', name:'Health & Dental Insurance',  desc:'Planstin enrollment forms and plan details',            type:'coming' },
  { id:'401k',      icon:'💰', name:'401K Enrollment',            desc:'100% match on first 4% — enrollment and fund selection', type:'coming' },
  { id:'pto',       icon:'🌴', name:'PTO & Holiday Policy',       desc:'Time-off accrual schedule and holiday calendar',        type:'coming' },
  { id:'harassment',icon:'⚖️', name:'Harassment Prevention',      desc:'Annual training materials and policy acknowledgment',   type:'coming' },
  { id:'driver',    icon:'🚗', name:"Driver's Safety Policy",     desc:'Required for all employees who operate company vehicles', type:'coming' },
  { id:'wex',       icon:'⛽', name:'Wex Fuel Card Guide',        desc:'Fuel card usage policy and how to report mileage',      type:'coming' },
  { id:'st-guide',  icon:'📱', name:'Service Titan User Guide',   desc:'How to use Service Titan for scheduling, invoicing & CRM', type:'coming' },
]

// ─── Department-specific resources ───────────────────────────────────────────
const DEPT_RESOURCES = {
  'HVAC-Service': [
    {
      id:'hvac-scorecard', icon:'📋',
      name:'Service Essentials Scorecard — HVAC',
      desc:'CertainPath scorecard covering all 6 steps: Setting the Tone, Building Credibility, Today\u2019s Service Experience, Diagnose/Evaluate, Present Options, and Close Out the Call.',
      pdfKey:'hvac_scorecard', embedded:true, tag:'Service Scorecard',
    },
    {
      id:'svc-schedule', icon:'📅',
      name:'HVAC Service Onboarding Schedule',
      desc:'The Christmas Way service training schedule: Day 1 through Day 60. Ride-alongs, vehicle assignment, goal check-ups, and KPIs.',
      pdfKey:'service_onboarding', embedded:true,
      tag:'Service Onboarding',
    },
    { id:'hvac-jd',      icon:'📄', name:'HVAC Service Tech Job Description',    desc:'Full job description and role expectations', type:'coming' },
    { id:'hvac-levels',  icon:'🔧', name:'Technician Level Guide (L1–L5)',        desc:'Skill progression and sign-off requirements', type:'coming' },
    { id:'hvac-safety',  icon:'⚠️', name:'Refrigerant Handling & Safety Protocol',desc:'EPA regulations and safety requirements', type:'coming' },
    { id:'hvac-pricing', icon:'💲', name:'StraightForward Pricing® Guide',        desc:'How to present pricing options to customers', type:'coming' },
  ],
  'HVAC-Install': [
    {
      id:'hvac-scorecard-inst', icon:'📋',
      name:'Service Essentials Scorecard — HVAC',
      desc:'CertainPath scorecard covering all 6 steps: Setting the Tone, Building Credibility, Today\u2019s Service Experience, Diagnose/Evaluate, Present Options, and Close Out the Call.',
      pdfKey:'hvac_scorecard', embedded:true, tag:'Service Scorecard',
    },
    { id:'inst-jd',      icon:'📄', name:'HVAC Installer Job Description',   desc:'Full job description and role expectations', type:'coming' },
    { id:'inst-process', icon:'🏗️', name:'Installation Process & Standards',  desc:'Step-by-step installation requirements', type:'coming' },
    { id:'inst-permits', icon:'📋', name:'Permit & Inspection Checklist',     desc:'Required permits and inspection procedures', type:'coming' },
    { id:'inst-safety',  icon:'⚠️', name:'Job Site Safety Requirements',      desc:'PPE, site protocols, and safety standards', type:'coming' },
  ],
  'Plumbing': [
    { id:'plmb-jd',      icon:'📄', name:'Plumbing Technician Job Description', desc:'Full job description and role expectations', type:'coming' },
    { id:'plmb-codes',   icon:'📏', name:'Local Plumbing Code Reference',        desc:'Code requirements for common service work', type:'coming' },
    { id:'plmb-pricing', icon:'💲', name:'StraightForward Pricing® Guide',       desc:'How to present pricing options to customers', type:'coming' },
    { id:'plmb-safety',  icon:'⚠️', name:'Safety & Hazardous Material Protocol', desc:'Required safety procedures for plumbing work', type:'coming' },
  ],
  'Office/Admin': [
    { id:'admin-jd',    icon:'📄', name:'Office/Admin Job Description',      desc:'Full job description and role expectations', type:'coming' },
    { id:'admin-st',    icon:'📱', name:'Service Titan Dispatch Training',   desc:'How to schedule, dispatch, and manage jobs', type:'coming' },
    { id:'admin-phone', icon:'📞', name:'Phone & Customer Service Standards',desc:'Call handling scripts and service standards', type:'coming' },
    { id:'admin-sched', icon:'📅', name:'Scheduling Policies & Procedures', desc:'Rules and best practices for booking jobs', type:'coming' },
  ],
  'Warehouse': [
    {
      id:'wh-perf-eval', icon:'📊',
      name:'Warehouse Performance Evaluation Form',
      desc:'Comprehensive evaluation covering Work Quality, Productivity, Safety, Teamwork, and Initiative. Both employee and manager score each category 1–5.',
      pdfKey:'warehouse_eval', embedded:true, tag:'Performance Review',
    },
    { id:'wh-jd',      icon:'📄', name:'Warehouse Lead Job Description',     desc:'Full job description and role expectations', type:'coming' },
    { id:'wh-inv',     icon:'📦', name:'Inventory Management Procedures',    desc:'Receiving, stocking, and cycle count processes', type:'coming' },
    { id:'wh-truck',   icon:'🚛', name:'Truck Stocking Standards',           desc:'What belongs on each service van and how to stock it', type:'coming' },
    { id:'wh-safety',  icon:'⚠️', name:'Warehouse Safety & Equipment Guide', desc:'Safe operation of equipment and safety procedures', type:'coming' },
  ],
  'Sales': [
    { id:'sales-jd',      icon:'📄', name:'Sales Associate Job Description',    desc:'Full job description and role expectations', type:'coming' },
    { id:'sales-pricing', icon:'💲', name:'StraightForward Pricing® Guide',      desc:'Full pricing presentation guide', type:'coming' },
    { id:'sales-script',  icon:'🗣️', name:'Sales Scripts & Objection Handling',  desc:'Scripts for common sales scenarios', type:'coming' },
    { id:'sales-club',    icon:'⭐', name:'Club Membership Sales Playbook',      desc:'How to present and close club memberships', type:'coming' },
    { id:'sales-crm',     icon:'📱', name:'CRM & Service Titan for Sales',       desc:'Using Service Titan to manage your pipeline', type:'coming' },
  ],
}

const DEPT_ICONS = {
  'HVAC-Service':'🔧','HVAC-Install':'🏗️','Plumbing':'🔩',
  'Office/Admin':'💼','Warehouse':'📦','Sales':'📈',
}

// ─── Single resource card ─────────────────────────────────────────────────────
const REVIEW_30_SECTIONS = [
  { label:'Onboarding & General', qs:['How have your first 30 days and the onboarding process gone?','Do you have any specific feedback for me?'] },
  { label:'About the Position',   qs:['How does the job compare to your expectations thus far?','What do you find challenging about your role?','What questions do you have about the position?','Are there any additional tools necessary to perform your job?','What areas of your expertise could be better utilized?'] },
  { label:'About the Team',       qs:['Are you feeling welcomed by the team?','How has the team helped (or not) with your onboarding?','Do you find it easy to communicate with your team?'] },
  { label:'About the Company',    qs:['Has the company met your expectations?','What do you think about the company culture?','Do you feel you have a good work-life balance?'] },
  { label:'Goals',                qs:['Have you reached your 30-day goals?','What challenges have you met in your 30-day goals?','What are your 60- and 90-day goals?'] },
]

function Review30Modal({ onClose }) {
  const [answers, setAnswers] = useState({})
  const [empName, setEmpName] = useState('')
  const [mgr, setMgr] = useState('')
  const [date, setDate] = useState('')
  const [printed, setPrinted] = useState(false)

  function handlePrint() {
    let text = '30-Day Review\nEmployee: ' + empName + '  |  Manager: ' + mgr + '  |  Date: ' + date + '\n'
    REVIEW_30_SECTIONS.forEach(function(sec) {
      text += '\n' + sec.label.toUpperCase() + '\n'
      sec.qs.forEach(function(q, i) {
        text += 'Q: ' + q + '\n'
        text += 'A: ' + (answers[sec.label + '-' + i] || '') + '\n\n'
      })
    })
    var w = window.open('', '_blank')
    w.document.write('<pre style="font-family:Georgia,serif;padding:2rem;max-width:700px;margin:0 auto;line-height:1.7;white-space:pre-wrap">' + text + '</pre>')
    w.document.close()
    w.print()
    setPrinted(true)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(14,8,2,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'1rem',overflowY:'auto'}} onClick={onClose}>
      <div style={{background:'var(--paper)',border:'2px solid var(--tan)',borderRadius:14,padding:'0',width:'100%',maxWidth:720,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 16px 48px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
        <div style={{background:'var(--green-dk)',padding:'16px 22px',borderRadius:'12px 12px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:'var(--cream)'}}>30-Day Review — Discussion Questions</div>
            <div style={{fontSize:11,color:'rgba(240,234,216,.55)',marginTop:1}}>All departments · Fill in and print or save</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handlePrint} style={{padding:'7px 14px',background:'var(--maroon)',color:'#fff',border:'none',borderRadius:7,fontSize:11,fontWeight:800,cursor:'pointer'}}>Print / Save</button>
            <button onClick={onClose} style={{padding:'7px 14px',background:'rgba(255,255,255,.15)',color:'#fff',border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer'}}>Close</button>
          </div>
        </div>
        <div style={{overflowY:'auto',padding:'18px 22px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
            {[['Employee Name','empName',setEmpName],['Manager','mgr',setMgr],['Date','date',setDate]].map(([l,k,fn])=>(
              <div key={k}>
                <label style={{fontSize:9.5,color:'var(--muted)',display:'block',marginBottom:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{l}</label>
                <input type={k==='date'?'date':'text'} onChange={e=>fn(e.target.value)} style={{width:'100%',fontSize:12,padding:'6px 9px',border:'1.5px solid var(--tan)',borderRadius:5,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)'}}/>
              </div>
            ))}
          </div>
          {REVIEW_30_SECTIONS.map(sec=>(
            <div key={sec.label} style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--green-dk)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,paddingBottom:5,borderBottom:'1.5px solid var(--tan)'}}>{sec.label}</div>
              {sec.qs.map((q,i)=>(
                <div key={i} style={{marginBottom:10}}>
                  <label style={{fontSize:12,fontWeight:600,color:'var(--text)',display:'block',marginBottom:4}}>● {q}</label>
                  <textarea rows={2} onChange={e=>setAnswers(p=>({...p,[`${sec.label}-${i}`]:e.target.value}))}
                    placeholder="Notes / response…"
                    style={{width:'100%',fontSize:11,padding:'6px 8px',border:'1.5px solid var(--tan)',borderRadius:5,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)',resize:'vertical',lineHeight:1.5}}/>
                </div>
              ))}
            </div>
          ))}
          <div style={{display:'flex',gap:8,paddingTop:8}}>
            <button onClick={handlePrint} style={{padding:'9px 20px',background:'var(--green)',color:'#fff',border:'none',borderRadius:7,fontSize:12,fontWeight:800,cursor:'pointer'}}>Print / Save as PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({ res, accentColor }) {
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState('')
  const [show30, setShow30] = useState(false)

  const hasEmbed = !!res.pdfKey || res.type === 'review30'
  const color = accentColor || 'var(--green)'

  function save() {
    if (url.trim()) { setSaved(url.trim()); setEditing(false) }
  }

  return (
    <div style={{
      background: hasEmbed ? 'var(--paper)' : 'var(--paper)',
      border: `1.5px solid ${hasEmbed ? color : 'var(--tan)'}`,
      borderRadius: 9, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      transition: 'box-shadow .15s',
      boxShadow: hasEmbed ? `0 2px 8px ${color}22` : 'none',
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: hasEmbed ? color : (saved ? 'var(--green)' : 'var(--parch)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>{res.icon}</div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{res.name}</div>
          {res.tag && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase',
              background: `${color}22`, color: color, borderRadius: 4, padding: '1px 6px',
            }}>{res.tag}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45, marginBottom: 8 }}>{res.desc}</div>

        {/* Embedded PDF / native form open button */}
        {res.type === 'review30' && (
          <>
            {show30 && <Review30Modal onClose={()=>setShow30(false)}/>}
            <button
              onClick={() => setShow30(true)}
              style={{ padding:'6px 14px', background:color, color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:800, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, letterSpacing:'.03em' }}>
              📝 Open Form
            </button>
          </>
        )}
        {hasEmbed && res.pdfKey && (
          <button
            onClick={() => openPDF(res.pdfKey, res.name)}
            style={{
              padding: '6px 14px',
              background: color,
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              letterSpacing: '.03em', transition: 'opacity .15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '.85'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            📄 Open Document ↗
          </button>
        )}

        {/* Link-based resource */}
        {!hasEmbed && (
          <>
            {saved && !editing && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={saved} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>
                  Open document ↗
                </a>
                <button onClick={() => setEditing(true)}
                  style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Edit link
                </button>
              </div>
            )}
            {(editing || !saved) && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  placeholder="Paste a URL or Google Drive link…"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  style={{
                    flex: 1, fontSize: 11, padding: '5px 9px',
                    border: '1.5px solid var(--tan)', borderRadius: 5,
                    background: '#fff', outline: 'none', fontFamily: 'inherit', color: 'var(--text)',
                  }}
                />
                <button onClick={save}
                  style={{ padding: '5px 12px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Save
                </button>
                {editing && (
                  <button onClick={() => { setEditing(false); setUrl(saved) }}
                    style={{ padding: '5px 9px', background: 'none', border: '1.5px solid var(--tan)', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Status badge */}
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
        color: hasEmbed ? color : (saved ? 'var(--green)' : 'var(--tan-dk)'),
        flexShrink: 0, paddingTop: 2, whiteSpace: 'nowrap',
      }}>
        {hasEmbed ? '✓ Available' : saved ? '✓ Linked' : 'Coming soon'}
      </div>
    </div>
  )
}

// ─── Main Resources page ──────────────────────────────────────────────────────
export default function Resources() {
  const [activeDept, setActiveDept] = useState(null)

  // Jingle Bills reward tiers
  const rewards = [
    { bills:'$10',  reward:'$5 Gift Card to a fast food restaurant' },
    { bills:'$25',  reward:'Company swag (hat, tumbler, etc.)' },
    { bills:'$30',  reward:'Personalized Christmas shirt or hoodie' },
    { bills:'$50',  reward:'Half day paid time off' },
    { bills:'$100', reward:'Full day off' },
    { bills:'$150', reward:'Switch roles with your manager for the day' },
  ]

  const earnWays = [
    'Going above and beyond daily responsibilities',
    'Helping coworkers or stepping in when needed',
    'Positive customer reviews or feedback',
    'Handling large, urgent, or complex jobs',
    'Representing company values',
    'Exceptional teamwork or leadership',
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-dk)', marginBottom: 4 }}>Resources</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Company-wide documents, department guides, and helpful links. Documents marked <strong style={{color:'var(--green)'}}>Available</strong> open directly. Paste a URL next to any <em>Coming soon</em> item to link your own document.
        </div>
      </div>

      {/* ── JINGLE BILLS CALLOUT ── */}
      <div style={{
        background:'linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 100%)',
        border:'2px solid #9a8a3a', borderRadius:12, padding:'16px 20px',
        marginBottom:'1.75rem', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
      }}>
        <div style={{fontSize:36}}>⭐</div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800,color:'#f0c040',fontFamily:'Georgia,serif'}}>Jingle Bills — Employee Recognition</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginTop:2}}>
            Award Jingle Bills in real time. Employees redeem them for prizes, perks, and paid time off.
            View the full interactive reward catalog, leaderboard, and activity log in the Jingle Bills tab.
          </div>
        </div>
        <button onClick={()=>openPDF('employee_recognition','Employee Recognition Program')}
          style={{padding:'8px 16px',background:'#9a8a3a',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>
          📄 View Presentation ↗
        </button>
      </div>

      {/* ── COMPANY-WIDE RESOURCES ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingBottom:10, borderBottom:'2px solid var(--tan)' }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--green-dk)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏢</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--green-dk)' }}>Company-Wide Resources</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>Available to all employees and departments</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:10 }}>
          {COMPANY_RESOURCES.map(r => <ResourceCard key={r.id} res={r} accentColor="var(--green)" />)}
        </div>
      </div>

      {/* ── DEPARTMENT RESOURCES ── */}
      <div>
        <div style={{ marginBottom:4 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'var(--green-dk)' }}>Department Resources</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>Select a department to view its specific guides and documents.</div>
        </div>

        {/* Dept selector */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {DEPARTMENTS.map(d => {
            const t = DEPT_THEME[d]
            const active = activeDept === d
            const hasAvailable = (DEPT_RESOURCES[d]||[]).some(r => r.pdfKey)
            return (
              <button key={d} onClick={() => setActiveDept(active ? null : d)}
                style={{
                  padding:'7px 16px', borderRadius:20,
                  border:`2px solid ${active ? t.tab : t.stripe}`,
                  background: active ? t.tab : t.light,
                  color: active ? '#fff' : t.lightTx,
                  fontSize:12, fontWeight:700, cursor:'pointer',
                  transition:'all .15s',
                  display:'flex', alignItems:'center', gap:6,
                  position:'relative',
                }}>
                <span>{DEPT_ICONS[d]}</span>
                {d}
                {hasAvailable && !active && (
                  <span style={{ width:6, height:6, borderRadius:'50%', background:t.tab, flexShrink:0 }}/>
                )}
                {active && <span style={{ fontSize:10 }}>▲</span>}
              </button>
            )
          })}
        </div>

        {activeDept && (() => {
          const t = DEPT_THEME[activeDept]
          const res = DEPT_RESOURCES[activeDept] || []
          return (
            <div style={{ background:t.body, border:`2px solid ${t.stripe}`, borderRadius:12, padding:'18px 20px', animation:'slideDown .2s ease-out' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:t.tab, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                  {DEPT_ICONS[activeDept]}
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:t.lightTx }}>{activeDept} Resources</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>Department-specific documents and guides</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:10 }}>
                {res.map(r => <ResourceCard key={r.id} res={r} accentColor={t.tab} />)}
              </div>
            </div>
          )
        })()}

        {!activeDept && (
          <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--muted)', fontSize:13, background:'var(--cream)', border:'1.5px dashed var(--tan)', borderRadius:10 }}>
            Select a department above to view its resources
          </div>
        )}
      </div>
    </div>
  )
}
