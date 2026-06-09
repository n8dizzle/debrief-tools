import { useState, useCallback } from 'react'
import { PHASES, TASKS, SAMPLE_EMPLOYEES } from '../data'

function buildTaskState(phaseFill) {
  const s = {}
  PHASES.forEach((p, pi) => {
    const fill = phaseFill ? phaseFill[pi] : 0
    Object.keys(TASKS[p.id]).forEach(r =>
      TASKS[p.id][r].forEach((_, ti) => {
        s[`${p.id}_${r}_${ti}`] = Math.random() < fill ? 'Done' : 'Not Started'
      })
    )
  })
  return s
}

function allKeys() {
  const keys = []
  PHASES.forEach(p => Object.keys(TASKS[p.id]).forEach(r =>
    TASKS[p.id][r].forEach((_, ti) => keys.push(`${p.id}_${r}_${ti}`))
  ))
  return keys
}

export function useOnboarding() {
  const [employees, setEmployees] = useState(() =>
    SAMPLE_EMPLOYEES.map((s, i) => ({ id: `emp_${i}`, ...s, colorIdx: i % 7 }))
  )
  const [completedEmployees, setCompletedEmployees] = useState([])
  const [openId, setOpenId] = useState(null)
  const [openPhase, setOpenPhase] = useState(null) // for clicking phase bars in overview

  const [taskState,    setTaskState]    = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]=buildTaskState(SAMPLE_EMPLOYEES[i].phaseFill) }); return o })
  const [customTasks,  setCustomTasks]  = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })
  const [skillState,   setSkillState]   = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })
  const [evalState,    setEvalState]    = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })
  const [customEvals,  setCustomEvals]  = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })
  const [docState,     setDocState]     = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })
  const [formData,     setFormData]     = useState(() => { const o={}; SAMPLE_EMPLOYEES.forEach((_,i)=>{ o[`emp_${i}`]={} }); return o })

  const empPct = useCallback((id) => {
    const ts = taskState[id] || {}
    const ct = customTasks[id] || {}
    const baseKeys = allKeys()
    const baseDone = baseKeys.filter(k => ts[k] === 'Done').length
    // count custom tasks
    let custTotal = 0, custDone = 0
    Object.values(ct).forEach(phaseMap =>
      Object.values(phaseMap || {}).forEach(arr =>
        (arr || []).forEach(t => { custTotal++; if (t.done) custDone++ })
      )
    )
    const total = baseKeys.length + custTotal
    const done  = baseDone + custDone
    return total ? Math.round(done / total * 100) : 0
  }, [taskState, customTasks])

  const phasePct = useCallback((id, phaseId) => {
    const ts = taskState[id] || {}
    const ct = (customTasks[id] || {})[phaseId] || {}
    const roles = TASKS[phaseId]; let t=0, d=0
    Object.keys(roles).forEach(r => roles[r].forEach((_,ti) => {
      t++; if(ts[`${phaseId}_${r}_${ti}`]==='Done') d++
    }))
    Object.values(ct).forEach(arr => (arr||[]).forEach(task => { t++; if(task.done) d++ }))
    return t ? Math.round(d/t*100) : 0
  }, [taskState, customTasks])

  const empPhaseLabel = useCallback((id) => {
    const p = empPct(id)
    if(p>=95) return { label:'1-Year',      color:'#085041', bg:'#E1F5EE' }
    if(p>=70) return { label:'6mo–1yr',     color:'#0C447C', bg:'#E6F1FB' }
    if(p>=45) return { label:'Day 46+',     color:'#633806', bg:'#FAEEDA' }
    if(p>=25) return { label:'Day 15+',     color:'#712B13', bg:'#FAECE7' }
    if(p>=10) return { label:'Day 2–14',    color:'#3C3489', bg:'#EEEDFE' }
    if(p>=2)  return { label:'Day 1',       color:'#085041', bg:'#E1F5EE' }
    return           { label:'Pre-boarding',color:'#5F5E5A', bg:'#F1EFE8' }
  }, [empPct])

  const addEmployee = useCallback((data) => {
    const id = `emp_${Date.now()}`
    setEmployees(prev => [...prev, { id, ...data, colorIdx: prev.length % 7 }])
    setTaskState(prev   => ({ ...prev, [id]: buildTaskState(null) }))
    setCustomTasks(prev => ({ ...prev, [id]: {} }))
    setSkillState(prev  => ({ ...prev, [id]: {} }))
    setEvalState(prev   => ({ ...prev, [id]: {} }))
    setCustomEvals(prev => ({ ...prev, [id]: {} }))
    setDocState(prev    => ({ ...prev, [id]: {} }))
    setFormData(prev    => ({ ...prev, [id]: {} }))
    setOpenId(id)
  }, [])

  const updateEmployee = useCallback((id, field, value) =>
    setEmployees(prev => prev.map(e => e.id===id ? {...e,[field]:value} : e)), [])

  // base tasks
  const toggleTask   = useCallback((id, key) =>
    setTaskState(prev => ({ ...prev, [id]: { ...prev[id], [key]: prev[id]?.[key]==='Done'?'Not Started':'Done' } })), [])
  const setTaskStatus = useCallback((id, key, value) =>
    setTaskState(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } })), [])

  // select-all for a phase+role
  const selectAllTasks = useCallback((id, phaseId, role, status) => {
    setTaskState(prev => {
      const next = { ...prev[id] }
      TASKS[phaseId][role].forEach((_, ti) => { next[`${phaseId}_${role}_${ti}`] = status })
      return { ...prev, [id]: next }
    })
  }, [])

  // custom tasks
  const addCustomTask = useCallback((id, phaseId, role) => {
    setCustomTasks(prev => {
      const phase = prev[id]?.[phaseId] || {}
      const arr   = phase[role] || []
      return { ...prev, [id]: { ...prev[id], [phaseId]: { ...phase, [role]: [...arr, { text:'', done:false }] } } }
    })
  }, [])
  const updateCustomTask = useCallback((id, phaseId, role, idx, field, value) => {
    setCustomTasks(prev => {
      const arr = [...(prev[id]?.[phaseId]?.[role] || [])]
      arr[idx] = { ...arr[idx], [field]: value }
      return { ...prev, [id]: { ...prev[id], [phaseId]: { ...(prev[id]?.[phaseId]||{}), [role]: arr } } }
    })
  }, [])
  const removeCustomTask = useCallback((id, phaseId, role, idx) => {
    setCustomTasks(prev => {
      const arr = [...(prev[id]?.[phaseId]?.[role] || [])]
      arr.splice(idx, 1)
      return { ...prev, [id]: { ...prev[id], [phaseId]: { ...(prev[id]?.[phaseId]||{}), [role]: arr } } }
    })
  }, [])

  // skills
  const toggleSkill  = useCallback((id, li, ii) =>
    setSkillState(prev => { const k=`${li}_${ii}`; return { ...prev, [id]: { ...prev[id], [k]: !prev[id]?.[k] } } }), [])

  // evals
  const setEval      = useCallback((id, evId, skill, value) =>
    setEvalState(prev => ({ ...prev, [id]: { ...prev[id], [evId]: { ...prev[id]?.[evId], [skill]: Math.min(10,Math.max(0,parseFloat(value)||0)) } } })), [])
  const setEvalNote  = useCallback((id, evId, value) =>
    setEvalState(prev => ({ ...prev, [id]: { ...prev[id], [evId]: { ...prev[id]?.[evId], _note: value } } })), [])

  // custom eval lines
  const addCustomEval    = useCallback((id, evId) =>
    setCustomEvals(prev => ({ ...prev, [id]: { ...prev[id], [evId]: [...(prev[id]?.[evId]||[]), { label:'', score:0 }] } })), [])
  const updateCustomEval = useCallback((id, evId, idx, field, value) =>
    setCustomEvals(prev => {
      const arr = [...(prev[id]?.[evId]||[])]
      arr[idx] = { ...arr[idx], [field]: value }
      return { ...prev, [id]: { ...prev[id], [evId]: arr } }
    }), [])
  const removeCustomEval = useCallback((id, evId, idx) =>
    setCustomEvals(prev => {
      const arr = [...(prev[id]?.[evId]||[])]
      arr.splice(idx, 1)
      return { ...prev, [id]: { ...prev[id], [evId]: arr } }
    }), [])

  // docs
  const toggleDoc = useCallback((id, docId) =>
    setDocState(prev => ({ ...prev, [id]: { ...prev[id], [docId]: !prev[id]?.[docId] } })), [])

  const saveFormData = useCallback((id, docId, data) =>
    setFormData(prev => ({ ...prev, [id]: { ...prev[id], [docId]: data } })), [])

  const signOffEmployee = useCallback((id) => {
    const emp = employees.find(e => e.id===id); if(!emp) return
    const completedDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})
    setCompletedEmployees(prev => [...prev, { ...emp, completedDate }])
    setEmployees(prev => prev.filter(e => e.id!==id))
    setOpenId(null)
  }, [employees])

  return {
    employees, completedEmployees, openId, setOpenId,
    openPhase, setOpenPhase,
    taskState, customTasks, skillState, evalState, customEvals, docState,
    empPct, phasePct, empPhaseLabel,
    addEmployee, updateEmployee,
    toggleTask, setTaskStatus, selectAllTasks,
    addCustomTask, updateCustomTask, removeCustomTask,
    toggleSkill,
    setEval, setEvalNote,
    addCustomEval, updateCustomEval, removeCustomEval,
    toggleDoc, signOffEmployee,
    formData, saveFormData,
  }
}
