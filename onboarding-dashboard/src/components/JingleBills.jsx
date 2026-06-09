import { printJingleBills } from '../jingleBillPrinter'
import { useState } from 'react'

const CATEGORIES = [
  { id:'food',  label:'Food & Drinks',  icon:'🍔', color:'#c05020' },
  { id:'swag',  label:'Company Swag',   icon:'👕', color:'#4e7c5f' },
  { id:'time',  label:'Time Off',       icon:'🌴', color:'#1a6b8a' },
  { id:'exp',   label:'Experiences',    icon:'🎉', color:'#9a4a9a' },
  { id:'cash',  label:'Gift Cards',     icon:'💳', color:'#9a8a3a' },
  { id:'fun',   label:'Fun & Perks',    icon:'⭐', color:'#8b2635' },
  { id:'dev',   label:'Growth',         icon:'📚', color:'#2f5240' },
]

const REWARDS = [
  { id:'r01', cat:'food', name:'Fast Food Gift Card',      cost:10,  icon:'🍔', desc:"$5 gift card to McDonald's, Whataburger, Chick-fil-A, or your choice",      popular:false },
  { id:'r02', cat:'food', name:'Starbucks / Coffee Run',  cost:15,  icon:'☕', desc:'$10 Starbucks card or coffee for you and a coworker',                        popular:true  },
  { id:'r03', cat:'food', name:'Lunch on the Company',    cost:30,  icon:'🥙', desc:'$20 to any restaurant — sit-down, takeout, or delivery',                     popular:true  },
  { id:'r04', cat:'food', name:'Team Pizza Party',        cost:75,  icon:'🍕', desc:'Pizza lunch for your whole crew — you pick the day',                         popular:false },
  { id:'r05', cat:'swag', name:'Christmas Air Hat',       cost:15,  icon:'🧢', desc:'Official company hat with logo — your choice of style',                     popular:false },
  { id:'r06', cat:'swag', name:'Christmas Air Tumbler',   cost:25,  icon:'🥤', desc:'Branded tumbler or water bottle',                                           popular:true  },
  { id:'r07', cat:'swag', name:'Personalized Work Shirt', cost:30,  icon:'👕', desc:'Custom Christmas Air shirt or polo with your name',                         popular:true  },
  { id:'r08', cat:'swag', name:'Christmas Hoodie',        cost:40,  icon:'🧥', desc:'Branded Christmas Air hoodie — your size and color',                        popular:false },
  { id:'r09', cat:'swag', name:'Full Swag Bundle',        cost:80,  icon:'🎁', desc:'Hat + shirt + tumbler — the whole kit',                                     popular:false },
  { id:'r10', cat:'time', name:'Leave 1 Hour Early',      cost:20,  icon:'🕐', desc:'Pick any day — leave one hour before shift ends',                           popular:true  },
  { id:'r11', cat:'time', name:'Come In 1 Hour Late',     cost:20,  icon:'😴', desc:'Sleep in — come in one hour late on any scheduled day',                     popular:false },
  { id:'r12', cat:'time', name:'Half Day Off (paid)',      cost:50,  icon:'🌤', desc:'4 hours of paid time off — any day with manager approval',                  popular:true  },
  { id:'r13', cat:'time', name:'Full Day Off (paid)',      cost:100, icon:'🌴', desc:'A full paid day off — schedule at least one week in advance',               popular:true  },
  { id:'r14', cat:'time', name:'Vacation Day Bonus',       cost:150, icon:'✈', desc:'Extra paid vacation day added to your PTO bank',                            popular:false },
  { id:'r15', cat:'exp',  name:'Movie Tickets (2)',        cost:35,  icon:'🎬', desc:'Two tickets to any local theater of your choice',                           popular:false },
  { id:'r16', cat:'exp',  name:'Sports Game Tickets',     cost:75,  icon:'🏟', desc:'Pair of tickets to a local game — Rangers, Mavs, Stars, or FC Dallas',     popular:true  },
  { id:'r17', cat:'exp',  name:'Switch Roles w/ Manager', cost:150, icon:'🎭', desc:"Spend a day in your manager's shoes — shadow their role for a full shift",  popular:true  },
  { id:'r18', cat:'exp',  name:'VIP Parking Spot',        cost:25,  icon:'🚗', desc:'The best parking spot at the shop for one full week',                       popular:false },
  { id:'r19', cat:'exp',  name:'Team Happy Hour',         cost:100, icon:'🍻', desc:'Company-sponsored team outing after work — you pick the spot',              popular:false },
  { id:'r20', cat:'cash', name:'Amazon Gift Card $25',    cost:30,  icon:'📦', desc:'$25 Amazon gift card delivered same day via email',                         popular:true  },
  { id:'r21', cat:'cash', name:'Gas Card $25',            cost:30,  icon:'⛽', desc:'$25 fuel gift card — works at most major gas stations',                     popular:true  },
  { id:'r22', cat:'cash', name:'Visa Gift Card $50',      cost:60,  icon:'💳', desc:'$50 Visa prepaid card — spend it anywhere',                                 popular:true  },
  { id:'r23', cat:'cash', name:'Visa Gift Card $100',     cost:115, icon:'💰', desc:'$100 Visa prepaid card — the big one',                                      popular:false },
  { id:'r24', cat:'fun',  name:'Wear Jeans to Work',      cost:10,  icon:'👖', desc:'One casual day — jeans and a Christmas Air shirt, no questions asked',      popular:true  },
  { id:'r25', cat:'fun',  name:'Pick Your Radio Station', cost:5,   icon:'🎵', desc:'Control the shop or truck radio for a full day',                            popular:false },
  { id:'r26', cat:'fun',  name:'Extra 30-Min Lunch',      cost:15,  icon:'🕛', desc:'Add 30 minutes to your lunch break on any day',                             popular:false },




  { id:'r31', cat:'dev',  name:'Trade Show Ticket',       cost:100, icon:'🏛', desc:'Attend an industry trade show or training event on company time',           popular:false },
  { id:'r32', cat:'dev',  name:'Mentorship Session',      cost:25,  icon:'🤝', desc:'1-on-1 career coaching session with a senior team member or leader',        popular:false },

]

const EARN_WAYS = [
  { icon:'⭐', label:'Going above & beyond' },
  { icon:'🤝', label:'Helping coworkers' },
  { icon:'💬', label:'Great customer review' },
  { icon:'🔧', label:'Complex or urgent job' },
  { icon:'🏅', label:'Representing company values' },
  { icon:'🚀', label:'Exceptional teamwork or leadership' },
]

function JBIcon({ size=32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#9a8a3a"/>
      <rect x="2" y="2" width="28" height="28" rx="5" fill="none" stroke="#f0c040" strokeWidth="1.5"/>
      <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Georgia,serif">J$</text>
    </svg>
  )
}

function AwardModal({ employees, preselect, onAward, onClose }) {
  const [emp, setEmp]       = useState(preselect||'')
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [sent, setSent]     = useState(false)
  function submit() {
    if(!emp||!reason.trim()) return
    const name = employees.find(e=>e.id===emp)?.name||''
    onAward({ empId:emp, empName:name, amount:Number(amount), reason, date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) })
    setSent(true)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(14,8,2,.78)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'1rem'}} onClick={onClose}>
      <div style={{background:'#1a1a1a',border:'2px solid #9a8a3a',borderRadius:14,padding:'26px 28px',width:'100%',maxWidth:440,boxShadow:'0 16px 48px rgba(0,0,0,.7)'}} onClick={e=>e.stopPropagation()}>
        {sent ? (
          <div style={{textAlign:'center',padding:'1rem 0'}}>
            <div style={{fontSize:56,marginBottom:14}}>⭐</div>
            <div style={{fontSize:20,fontWeight:800,color:'#f0c040',marginBottom:8}}>Jingle Bills Awarded!</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.65)',marginBottom:20}}>
              {employees.find(e=>e.id===emp)?.name} just received <strong style={{color:'#f0c040'}}>{amount} Jingle Bill{amount>1?'s':''}</strong>!
            </div>
            <button onClick={onClose} style={{padding:'9px 24px',background:'#9a8a3a',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Done</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22}}>
              <JBIcon size={40}/><div>
                <div style={{fontSize:17,fontWeight:800,color:'#f0c040'}}>Award Jingle Bills</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginTop:1}}>Recognition in real time</div>
              </div>
            </div>
            <div style={{marginBottom:13}}>
              <label style={{fontSize:10,color:'rgba(255,255,255,.5)',display:'block',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Employee</label>
              <select value={emp} onChange={e=>setEmp(e.target.value)} style={{width:'100%',fontSize:13,padding:'8px 10px',border:'1.5px solid #9a8a3a',borderRadius:7,background:'#2a2a2a',color:'#fff',outline:'none',fontFamily:'inherit'}}>
                <option value="">Select employee…</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.dept}</option>)}
              </select>
            </div>
            <div style={{marginBottom:13}}>
              <label style={{fontSize:10,color:'rgba(255,255,255,.5)',display:'block',marginBottom:6,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Quantity of Jingle Bills</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                {[1,5,10,25,50].map(a=>(
                  <button key={a} onClick={()=>setAmount(a)} style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${amount===a?'#f0c040':'#444'}`,background:amount===a?'#9a8a3a':'transparent',color:amount===a?'#fff':'rgba(255,255,255,.6)',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                    {a}
                  </button>
                ))}
                <input type="number" min="1" max="999" value={amount} onChange={e=>setAmount(Math.max(1,parseInt(e.target.value)||1))} style={{width:72,padding:'6px 10px',border:'1.5px solid #444',borderRadius:8,background:'#2a2a2a',color:'#fff',fontSize:12,outline:'none',fontFamily:'inherit'}} placeholder="Custom"/>
                <span style={{fontSize:11,color:'rgba(255,255,255,.45)'}}>bills</span>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:10,color:'rgba(255,255,255,.5)',display:'block',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Reason for recognition</label>
              <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="e.g. Outstanding customer review, helped a teammate, went above and beyond…" style={{width:'100%',fontSize:12,padding:'8px 10px',border:`1.5px solid ${reason?'#9a8a3a':'#444'}`,borderRadius:7,background:'#2a2a2a',color:'#fff',resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.5}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={submit} disabled={!emp||!reason.trim()} style={{flex:1,padding:'10px',background:emp&&reason.trim()?'#9a8a3a':'#333',color:emp&&reason.trim()?'#fff':'rgba(255,255,255,.3)',border:'none',borderRadius:8,fontSize:13,fontWeight:800,cursor:emp&&reason.trim()?'pointer':'default',transition:'all .15s'}}>
                {'\u2B50'} Award {amount} Jingle Bill{amount>1?'s':''}
              </button>
              <button onClick={onClose} style={{padding:'10px 16px',background:'transparent',border:'1.5px solid #444',color:'rgba(255,255,255,.5)',borderRadius:8,fontSize:12,cursor:'pointer'}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RedeemModal({ reward, emp, balance, onRedeem, onClose }) {
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const cat = CATEGORIES.find(c=>c.id===reward.cat)
  const canAfford = balance >= reward.cost

  function submit() {
    onRedeem({ empId:emp.id, rewardId:reward.id, rewardName:reward.name, cost:reward.cost, note, date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) })
    setDone(true)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(14,8,2,.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'1rem'}} onClick={onClose}>
      <div style={{background:'var(--paper)',border:'2px solid var(--tan)',borderRadius:14,padding:'26px 28px',width:'100%',maxWidth:420,boxShadow:'0 16px 48px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
        {done ? (
          <div style={{textAlign:'center',padding:'1rem 0'}}>
            <div style={{fontSize:56,marginBottom:12}}>🎉</div>
            <div style={{fontSize:18,fontWeight:800,color:'var(--green-dk)',marginBottom:6}}>Redeemed!</div>
            <div style={{fontSize:12,color:'var(--muted)',marginBottom:20}}>
              <strong>{emp.name}</strong> redeemed <strong>{reward.name}</strong> for <strong style={{color:'#9a8a3a'}}>${reward.cost} Jingle Bills</strong>
            </div>
            <button onClick={onClose} style={{padding:'9px 24px',background:'var(--green)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Done</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
              <div style={{width:48,height:48,borderRadius:10,background:cat?.color||'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{reward.icon}</div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>{reward.name}</div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:1,lineHeight:1.4}}>{reward.desc}</div>
              </div>
            </div>
            <div style={{background:canAfford?'var(--green-lt)':'#fdeaea',border:`1.5px solid ${canAfford?'var(--green)':'var(--maroon)'}`,borderRadius:8,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,marginBottom:2}}>REDEEMING FOR</div>
                <div style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>{emp?.name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,marginBottom:2}}>BALANCE AFTER</div>
                <div style={{fontSize:16,fontWeight:800,color:canAfford?'var(--green)':'var(--maroon)'}}>
                  {canAfford ? `$${balance-reward.cost} JB` : `$${balance} (short $${reward.cost-balance})`}
                </div>
              </div>
            </div>
            {canAfford && (
              <div style={{marginBottom:14}}>
                <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Manager note (optional)</label>
                <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Approved — coordinate with HR" style={{width:'100%',fontSize:12,padding:'7px 10px',border:'1.5px solid var(--tan)',borderRadius:6,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)'}}/>
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              {canAfford
                ? <button onClick={submit} style={{flex:1,padding:'10px',background:cat?.color||'var(--green)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:800,cursor:'pointer'}}>
                    Confirm — ${reward.cost} Jingle Bills
                  </button>
                : <div style={{flex:1,padding:'10px',background:'#fdeaea',color:'var(--maroon)',borderRadius:8,fontSize:12,fontWeight:700,textAlign:'center',border:'1px solid var(--maroon)44'}}>
                    Not enough Jingle Bills
                  </div>
              }
              <button onClick={onClose} style={{padding:'10px 14px',background:'transparent',border:'1.5px solid var(--tan)',color:'var(--muted)',borderRadius:8,fontSize:12,cursor:'pointer'}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function JingleBills({ employees }) {
  const [activeCat,    setActiveCat]    = useState('all')
  const [search,       setSearch]       = useState('')
  const [showAward,    setShowAward]    = useState(false)
  const [awardPresel,  setAwardPresel]  = useState('')
  const [redeemReward, setRedeemReward] = useState(null)
  const [selectedEmp,  setSelectedEmp]  = useState('')
  const [balances,     setBalances]     = useState({})
  const [history,      setHistory]      = useState([])
  const [printEmp,     setPrintEmp]     = useState('')
  const [printMgr,     setPrintMgr]     = useState('')
  const [showPrintBar, setShowPrintBar]  = useState(false)

  function getBalance(id) { return balances[id]||0 }

  function handleAward(data) {
    setBalances(prev=>({...prev,[data.empId]:(prev[data.empId]||0)+data.amount}))
    setHistory(prev=>[{type:'award',...data},...prev])
    setShowAward(false); setAwardPresel('')
  }

  function handleRedeem(data) {
    setBalances(prev=>({...prev,[data.empId]:Math.max(0,(prev[data.empId]||0)-data.cost)}))
    const empName = employees.find(e=>e.id===data.empId)?.name||''
    setHistory(prev=>[{type:'redeem',empName,...data},...prev])
    setRedeemReward(null)
  }

  const empObj     = employees.find(e=>e.id===selectedEmp)
  const empBalance = getBalance(selectedEmp)

  const filtered = REWARDS.filter(r=>{
    const catOk = activeCat==='all'||r.cat===activeCat
    const srchOk = !search||r.name.toLowerCase().includes(search.toLowerCase())||r.desc.toLowerCase().includes(search.toLowerCase())
    return catOk&&srchOk
  })
  const popular = REWARDS.filter(r=>r.popular)

  const totalAwarded  = history.filter(h=>h.type==='award' ).reduce((s,h)=>s+(h.amount||0),0)
  const totalRedeemed = history.filter(h=>h.type==='redeem').reduce((s,h)=>s+(h.cost||0),0)
  const topEarner     = employees.length ? employees.reduce((b,e)=>getBalance(e.id)>getBalance(b.id)?e:b,employees[0]) : null

  function openRedeem(r) {
    if(!selectedEmp){ setSelectedEmp(''); alert('Select an employee in the sidebar first'); return }
    setRedeemReward(r)
  }

  return (
    <div>
      {showAward    && <AwardModal employees={employees} preselect={awardPresel} onAward={handleAward} onClose={()=>{setShowAward(false);setAwardPresel('')}}/>}
      {redeemReward && <RedeemModal reward={redeemReward} emp={empObj} balance={empBalance} onRedeem={handleRedeem} onClose={()=>setRedeemReward(null)}/>}

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1a1a1a 0%,#2a2218 100%)',borderRadius:14,padding:'22px 24px',marginBottom:'1.5rem',border:'2px solid #9a8a3a',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-30,right:-30,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(154,138,58,.2) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <JBIcon size={50}/>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:'#f0c040',fontFamily:'Georgia,serif'}}>Jingle Bills</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:2}}>Christmas Air Employee Recognition — Award &amp; Reward Catalog</div>
            </div>
          </div>
          <button onClick={()=>setShowAward(true)} style={{padding:'10px 20px',background:'#9a8a3a',color:'#fff',border:'none',borderRadius:9,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
            ⭐ Award Jingle Bills
          </button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8}}>
          {[
            {label:'Total Awarded',   val:`$${totalAwarded}`,   icon:'⭐'},
            {label:'Total Redeemed',  val:`$${totalRedeemed}`,  icon:'🎁'},
            {label:'Rewards in Catalog', val:REWARDS.length,   icon:'🛍'},
            {label:'Top Balance',     val:topEarner&&getBalance(topEarner.id)>0?`$${getBalance(topEarner.id)}`:'-', icon:'🏆'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,.07)',borderRadius:9,padding:'10px 12px',border:'1px solid rgba(154,138,58,.22)'}}>
              <div style={{fontSize:15,marginBottom:3}}>{s.icon}</div>
              <div style={{fontSize:18,fontWeight:800,color:'#f0c040',lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:9,color:'rgba(255,255,255,.38)',marginTop:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Print Bills section ── */}
      <div style={{background:'var(--paper)',border:'1.5px solid var(--tan)',borderRadius:10,padding:'14px 18px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:22}}>🖨️</div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:'var(--green-dk)'}}>Print Jingle Bills</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>8 bills per sheet · Cut and hand out · Pre-fill names or leave blank to fill by hand</div>
            </div>
          </div>
          <button onClick={()=>setShowPrintBar(v=>!v)}
            style={{padding:'8px 16px',background:showPrintBar?'var(--tan-dk)':'var(--green)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:800,cursor:'pointer'}}>
            {showPrintBar ? '▲ Close' : '🖨️ Set Up & Print'}
          </button>
        </div>
        {showPrintBar && (
          <div style={{marginTop:14,paddingTop:14,borderTop:'1.5px solid var(--tan)',display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 200px'}}>
              <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Employee Name (optional)</label>
              <input value={printEmp} onChange={e=>setPrintEmp(e.target.value)}
                placeholder="Leave blank to write by hand"
                style={{width:'100%',fontSize:12,padding:'7px 10px',border:'1.5px solid var(--tan)',borderRadius:6,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)'}}/>
            </div>
            <div style={{flex:'1 1 200px'}}>
              <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Manager / Authorized By (optional)</label>
              <input value={printMgr} onChange={e=>setPrintMgr(e.target.value)}
                placeholder="Leave blank to write by hand"
                style={{width:'100%',fontSize:12,padding:'7px 10px',border:'1.5px solid var(--tan)',borderRadius:6,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-start'}}>
              <button onClick={()=>printJingleBills({employeeName:printEmp,managerName:printMgr})}
                style={{padding:'9px 22px',background:'var(--maroon)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>
                🖨️ Open Print Sheet
              </button>
              <div style={{fontSize:10,color:'var(--muted)'}}>Opens new tab · Use Ctrl+P or File → Print</div>
            </div>
          </div>
        )}
      </div>

      {/* Main two-column layout */}
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 300px',gap:16,alignItems:'start',minWidth:0}}>

        {/* LEFT: catalog */}
        <div>
          {/* How to earn */}
          <div style={{background:'var(--paper)',border:'1.5px solid var(--tan)',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--green-dk)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>How employees earn Jingle Bills</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:5}}>
              {EARN_WAYS.map((w,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:11.5,color:'var(--text)',fontWeight:500}}>
                  <span style={{fontSize:14}}>{w.icon}</span>{w.label}
                </div>
              ))}
            </div>
          </div>

          {/* Popular picks */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--green-dk)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>⭐ Popular picks</div>
            <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6}}>
              {popular.map(r=>{
                const cat=CATEGORIES.find(c=>c.id===r.cat)
                return (
                  <div key={r.id} style={{flexShrink:0,background:'var(--paper)',border:`1.5px solid ${cat?.color||'var(--tan)'}`,borderRadius:9,padding:'10px 12px',width:150,cursor:'pointer',transition:'transform .12s,box-shadow .12s'}}
                    onClick={()=>openRedeem(r)}
                    onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 5px 14px ${cat?.color}44`}}
                    onMouseOut={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                    <div style={{fontSize:22,marginBottom:5}}>{r.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text)',marginBottom:3,lineHeight:1.3}}>{r.name}</div>
                    <div style={{fontSize:9.5,color:'var(--muted)',marginBottom:7,lineHeight:1.35}}>{r.desc.slice(0,52)}{r.desc.length>52?'…':''}</div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:13,fontWeight:800,color:cat?.color||'var(--green)'}}>${r.cost} JB</span>
                      <span style={{fontSize:9,background:`${cat?.color}22`,color:cat?.color,padding:'1px 6px',borderRadius:4,fontWeight:700,textTransform:'uppercase'}}>Redeem</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Category filter + search */}
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:10}}>
            <button onClick={()=>setActiveCat('all')} style={{padding:'5px 13px',borderRadius:20,border:`1.5px solid ${activeCat==='all'?'var(--green-dk)':'var(--tan)'}`,background:activeCat==='all'?'var(--green-dk)':'var(--paper)',color:activeCat==='all'?'#fff':'var(--muted)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
              All ({REWARDS.length})
            </button>
            {CATEGORIES.map(c=>(
              <button key={c.id} onClick={()=>setActiveCat(c.id)} style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${activeCat===c.id?c.color:'var(--tan)'}`,background:activeCat===c.id?c.color:'var(--paper)',color:activeCat===c.id?'#fff':'var(--muted)',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                {c.icon} {c.label}
              </button>
            ))}
            <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'5px 12px',border:'1.5px solid var(--tan)',borderRadius:20,fontSize:11,background:'var(--paper)',outline:'none',fontFamily:'inherit',color:'var(--text)',width:140}}/>
          </div>

          {/* Reward grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:9}}>
            {filtered.map(r=>{
              const cat=CATEGORIES.find(c=>c.id===r.cat)
              const canAfford=selectedEmp&&empBalance>=r.cost
              return (
                <div key={r.id} style={{background:'var(--paper)',border:`1.5px solid ${cat?.color||'var(--tan)'}33`,borderRadius:9,padding:'12px 13px',display:'flex',flexDirection:'column',gap:7,cursor:'pointer',opacity:selectedEmp&&!canAfford?.65:1,transition:'all .12s'}}
                  onMouseOver={e=>{e.currentTarget.style.boxShadow=`0 4px 14px ${cat?.color||'#888'}33`;e.currentTarget.style.borderColor=cat?.color||'var(--green)'}}
                  onMouseOut={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.borderColor=`${cat?.color||'var(--tan)'}33`}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{width:36,height:36,borderRadius:8,background:cat?.color||'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{r.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2,flexWrap:'wrap'}}>
                        <div style={{fontSize:11.5,fontWeight:700,color:'var(--text)'}}>{r.name}</div>
                        {r.popular&&<span style={{fontSize:8,fontWeight:800,background:'#f0c04022',color:'#9a8a3a',padding:'1px 5px',borderRadius:3,textTransform:'uppercase',letterSpacing:'.05em'}}>Popular</span>}
                      </div>
                      <div style={{fontSize:10,color:'var(--muted)',lineHeight:1.4}}>{r.desc}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'}}>
                    <span style={{fontSize:14,fontWeight:800,color:cat?.color||'var(--green)'}}>${r.cost} JB</span>
                    <button onClick={()=>openRedeem(r)} style={{padding:'5px 11px',background:canAfford?cat?.color||'var(--green)':'var(--parch)',color:canAfford?'#fff':'var(--muted)',border:'none',borderRadius:6,fontSize:10,fontWeight:800,cursor:selectedEmp?'pointer':'default',transition:'opacity .15s'}}>
                      {selectedEmp?(canAfford?'Redeem ↗':'Not enough JB'):'Select emp →'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div style={{position:'sticky',top:16,minWidth:0}}>
          {/* Leaderboard — always at top */}
          <div style={{background:'linear-gradient(135deg,#1a1a1a 0%,#2a2218 100%)',border:'1.5px solid #9a8a3a',borderRadius:10,padding:'13px',marginBottom:11}}>
            <div style={{fontSize:11,fontWeight:800,color:'#f0c040',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>🏆 Leaderboard</div>
            {employees.filter(e=>getBalance(e.id)>0).length===0
              ? <div style={{fontSize:11,color:'rgba(255,255,255,.35)',textAlign:'center',padding:'8px 0'}}>No bills awarded yet</div>
              : [...employees].sort((a,b)=>getBalance(b.id)-getBalance(a.id)).filter(e=>getBalance(e.id)>0).slice(0,8).map((e,i)=>(
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i<4?'1px solid rgba(154,138,58,.18)':'none'}}>
                  <span style={{fontSize:13,width:22,textAlign:'center',flexShrink:0}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.85)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
                    <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)'}}>{e.dept}</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:'#f0c040',flexShrink:0}}>{getBalance(e.id)} JB</span>
                </div>
              ))
            }
          </div>

          {/* Employee selector */}
          <div style={{background:'var(--paper)',border:'1.5px solid var(--tan)',borderRadius:10,padding:'13px',marginBottom:11}}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--green-dk)',marginBottom:7,textTransform:'uppercase',letterSpacing:'.06em'}}>Select Employee</div>
            <select value={selectedEmp} onChange={e=>setSelectedEmp(e.target.value)} style={{width:'100%',fontSize:12,padding:'7px 10px',border:'1.5px solid var(--tan)',borderRadius:7,background:'#fff',outline:'none',fontFamily:'inherit',color:'var(--text)',marginBottom:10}}>
              <option value="">Choose employee…</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.dept}</option>)}
            </select>
            {selectedEmp && empObj && (
              <>
                <div style={{background:'linear-gradient(135deg,#1a1a1a,#2a2218)',borderRadius:9,padding:'12px 13px',border:'1.5px solid #9a8a3a',marginBottom:9}}>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.45)',marginBottom:3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Current Balance</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <JBIcon size={26}/>
                    <div style={{fontSize:26,fontWeight:800,color:'#f0c040',lineHeight:1}}>{empBalance}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.38)'}}>Jingle Bills</div>
                  </div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.38)',marginTop:5}}>{empObj.dept} · {empObj.title}</div>
                </div>
                <button onClick={()=>{setAwardPresel(selectedEmp);setShowAward(true)}} style={{width:'100%',padding:'7px',background:'#9a8a3a',color:'#fff',border:'none',borderRadius:7,fontSize:11.5,fontWeight:800,cursor:'pointer'}}>
                  ⭐ Award Jingle Bills
                </button>
              </>
            )}
          </div>

          {/* Recent activity */}
          <div style={{background:'var(--paper)',border:'1.5px solid var(--tan)',borderRadius:10,padding:'13px'}}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--green-dk)',marginBottom:7,textTransform:'uppercase',letterSpacing:'.06em'}}>Recent Activity</div>
            {history.length===0
              ? <div style={{fontSize:11,color:'var(--muted)',textAlign:'center',padding:'1rem 0'}}>No activity yet — award some Jingle Bills to get started!</div>
              : <div style={{maxHeight:340,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
                  {history.slice(0,20).map((h,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,padding:'7px 8px',background:h.type==='award'?'var(--green-lt)':'#fff8e6',border:`1px solid ${h.type==='award'?'var(--green)':'#9a8a3a'}44`,borderRadius:7}}>
                      <span style={{fontSize:13,flexShrink:0}}>{h.type==='award'?'⭐':'🎁'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.empName}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:1,lineHeight:1.3}}>
                          {h.type==='award'?`+$${h.amount} — ${h.reason}`:`-$${h.cost} — ${h.rewardName}`}
                        </div>
                      </div>
                      <div style={{fontSize:9,color:'var(--muted)',flexShrink:0,whiteSpace:'nowrap'}}>{h.date}</div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
