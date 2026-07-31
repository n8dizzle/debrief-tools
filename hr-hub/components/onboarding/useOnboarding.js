import { useState, useCallback, useEffect, useRef } from 'react'
import { PHASES, TASKS } from './data'

// Persistence-backed onboarding state. Hydrates from /api/onboarding and saves each
// employee's mutable state slices (debounced) back to the DB. External API is identical
// to the original in-memory hook, so the ported components are unchanged.

function allKeys() {
  const keys = []
  PHASES.forEach(p => Object.keys(TASKS[p.id]).forEach(r =>
    TASKS[p.id][r].forEach((_, ti) => keys.push(`${p.id}_${r}_${ti}`))
  ))
  return keys
}

export function useOnboarding() {
  const [employees, setEmployees] = useState([])
  const [completedEmployees, setCompletedEmployees] = useState([])
  const [openId, setOpenId] = useState(null)
  const [openPhase, setOpenPhase] = useState(null)

  const [taskState, setTaskState] = useState({})
  const [customTasks, setCustomTasks] = useState({})
  const [skillState, setSkillState] = useState({})
  const [evalState, setEvalState] = useState({})
  const [customEvals, setCustomEvals] = useState({})
  const [docState, setDocState] = useState({})
  const [formData, setFormData] = useState({})

  // Latest-value refs for debounced saves.
  const refs = useRef({})
  refs.current = { taskState, customTasks, skillState, evalState, customEvals, docState, formData }
  const empRef = useRef({})

  // Hydrate from the API once.
  useEffect(() => {
    let alive = true
    fetch('/api/onboarding').then(r => r.json()).then(j => {
      if (!alive) return
      const active = [], done = []
      const ts = {}, ct = {}, ss = {}, es = {}, ce = {}, ds = {}, fd = {}
      for (const e of (j.employees || [])) {
        const emp = { ...e, colorIdx: e.color_idx ?? 0, completedDate: e.completed_date ?? null }
        empRef.current[e.id] = emp
        ;(e.status === 'completed' ? done : active).push(emp)
        const st = (j.state || {})[e.id] || {}
        ts[e.id] = st.task_state || {}; ct[e.id] = st.custom_tasks || {}; ss[e.id] = st.skill_state || {}
        es[e.id] = st.eval_state || {}; ce[e.id] = st.custom_evals || {}; ds[e.id] = st.doc_state || {}; fd[e.id] = st.form_data || {}
      }
      setEmployees(active); setCompletedEmployees(done)
      setTaskState(ts); setCustomTasks(ct); setSkillState(ss); setEvalState(es); setCustomEvals(ce); setDocState(ds); setFormData(fd)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Debounced save of one employee's state slices.
  const stateTimers = useRef({})
  const scheduleSave = useCallback((id) => {
    if (!id) return
    clearTimeout(stateTimers.current[id])
    stateTimers.current[id] = setTimeout(() => {
      const r = refs.current
      const body = { state: {
        task_state: r.taskState[id] || {}, custom_tasks: r.customTasks[id] || {}, skill_state: r.skillState[id] || {},
        eval_state: r.evalState[id] || {}, custom_evals: r.customEvals[id] || {}, doc_state: r.docState[id] || {}, form_data: r.formData[id] || {},
      } }
      fetch(`/api/onboarding/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
    }, 600)
  }, [])

  // Debounced save of one employee's profile fields.
  const empTimers = useRef({})
  const scheduleEmpSave = useCallback((id) => {
    if (!id) return
    clearTimeout(empTimers.current[id])
    empTimers.current[id] = setTimeout(() => {
      const e = empRef.current[id]; if (!e) return
      const emp = { name: e.name, title: e.title ?? null, dept: e.dept ?? null, mgr: e.mgr ?? null, start: e.start ?? null, type: e.type ?? null }
      fetch(`/api/onboarding/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp }) }).catch(() => {})
    }, 600)
  }, [])

  const empPct = useCallback((id) => {
    const ts = taskState[id] || {}
    const ct = customTasks[id] || {}
    const baseKeys = allKeys()
    const baseDone = baseKeys.filter(k => ts[k] === 'Done').length
    let custTotal = 0, custDone = 0
    Object.values(ct).forEach(phaseMap =>
      Object.values(phaseMap || {}).forEach(arr =>
        (arr || []).forEach(t => { custTotal++; if (t.done) custDone++ })
      )
    )
    const total = baseKeys.length + custTotal
    const done = baseDone + custDone
    return total ? Math.round(done / total * 100) : 0
  }, [taskState, customTasks])

  const phasePct = useCallback((id, phaseId) => {
    const ts = taskState[id] || {}
    const ct = (customTasks[id] || {})[phaseId] || {}
    const roles = TASKS[phaseId]; let t = 0, d = 0
    Object.keys(roles).forEach(r => roles[r].forEach((_, ti) => { t++; if (ts[`${phaseId}_${r}_${ti}`] === 'Done') d++ }))
    Object.values(ct).forEach(arr => (arr || []).forEach(task => { t++; if (task.done) d++ }))
    return t ? Math.round(d / t * 100) : 0
  }, [taskState, customTasks])

  const empPhaseLabel = useCallback((id) => {
    const p = empPct(id)
    if (p >= 95) return { label: '1-Year', color: '#085041', bg: '#E1F5EE' }
    if (p >= 70) return { label: '6mo–1yr', color: '#0C447C', bg: '#E6F1FB' }
    if (p >= 45) return { label: 'Day 46+', color: '#633806', bg: '#FAEEDA' }
    if (p >= 25) return { label: 'Day 15+', color: '#712B13', bg: '#FAECE7' }
    if (p >= 10) return { label: 'Day 2–14', color: '#3C3489', bg: '#EEEDFE' }
    if (p >= 2)  return { label: 'Day 1', color: '#085041', bg: '#E1F5EE' }
    return { label: 'Pre-boarding', color: '#5F5E5A', bg: '#F1EFE8' }
  }, [empPct])

  const addEmployee = useCallback(async (data) => {
    try {
      const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'add failed')
      const e = j.employee
      const emp = { ...e, colorIdx: e.color_idx ?? 0 }
      empRef.current[e.id] = emp
      setEmployees(prev => [...prev, emp])
      setTaskState(p => ({ ...p, [e.id]: {} })); setCustomTasks(p => ({ ...p, [e.id]: {} })); setSkillState(p => ({ ...p, [e.id]: {} }))
      setEvalState(p => ({ ...p, [e.id]: {} })); setCustomEvals(p => ({ ...p, [e.id]: {} })); setDocState(p => ({ ...p, [e.id]: {} })); setFormData(p => ({ ...p, [e.id]: {} }))
      setOpenId(e.id)
    } catch (err) {
      if (typeof window !== 'undefined') window.alert('Could not add new hire: ' + (err?.message || 'error'))
    }
  }, [])

  const updateEmployee = useCallback((id, field, value) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== id) return e
      const next = { ...e, [field]: value }; empRef.current[id] = next; return next
    }))
    scheduleEmpSave(id)
  }, [scheduleEmpSave])

  const toggleTask = useCallback((id, key) => {
    setTaskState(prev => ({ ...prev, [id]: { ...prev[id], [key]: prev[id]?.[key] === 'Done' ? 'Not Started' : 'Done' } })); scheduleSave(id)
  }, [scheduleSave])
  const setTaskStatus = useCallback((id, key, value) => {
    setTaskState(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } })); scheduleSave(id)
  }, [scheduleSave])
  const selectAllTasks = useCallback((id, phaseId, role, status) => {
    setTaskState(prev => { const next = { ...prev[id] }; TASKS[phaseId][role].forEach((_, ti) => { next[`${phaseId}_${role}_${ti}`] = status }); return { ...prev, [id]: next } }); scheduleSave(id)
  }, [scheduleSave])

  const addCustomTask = useCallback((id, phaseId, role) => {
    setCustomTasks(prev => { const phase = prev[id]?.[phaseId] || {}; const arr = phase[role] || []; return { ...prev, [id]: { ...prev[id], [phaseId]: { ...phase, [role]: [...arr, { text: '', done: false }] } } } }); scheduleSave(id)
  }, [scheduleSave])
  const updateCustomTask = useCallback((id, phaseId, role, idx, field, value) => {
    setCustomTasks(prev => { const arr = [...(prev[id]?.[phaseId]?.[role] || [])]; arr[idx] = { ...arr[idx], [field]: value }; return { ...prev, [id]: { ...prev[id], [phaseId]: { ...(prev[id]?.[phaseId] || {}), [role]: arr } } } }); scheduleSave(id)
  }, [scheduleSave])
  const removeCustomTask = useCallback((id, phaseId, role, idx) => {
    setCustomTasks(prev => { const arr = [...(prev[id]?.[phaseId]?.[role] || [])]; arr.splice(idx, 1); return { ...prev, [id]: { ...prev[id], [phaseId]: { ...(prev[id]?.[phaseId] || {}), [role]: arr } } } }); scheduleSave(id)
  }, [scheduleSave])

  const toggleSkill = useCallback((id, li, ii) => {
    setSkillState(prev => { const k = `${li}_${ii}`; return { ...prev, [id]: { ...prev[id], [k]: !prev[id]?.[k] } } }); scheduleSave(id)
  }, [scheduleSave])

  const setEval = useCallback((id, evId, skill, value) => {
    setEvalState(prev => ({ ...prev, [id]: { ...prev[id], [evId]: { ...prev[id]?.[evId], [skill]: Math.min(10, Math.max(0, parseFloat(value) || 0)) } } })); scheduleSave(id)
  }, [scheduleSave])
  const setEvalNote = useCallback((id, evId, value) => {
    setEvalState(prev => ({ ...prev, [id]: { ...prev[id], [evId]: { ...prev[id]?.[evId], _note: value } } })); scheduleSave(id)
  }, [scheduleSave])

  const addCustomEval = useCallback((id, evId) => {
    setCustomEvals(prev => ({ ...prev, [id]: { ...prev[id], [evId]: [...(prev[id]?.[evId] || []), { label: '', score: 0 }] } })); scheduleSave(id)
  }, [scheduleSave])
  const updateCustomEval = useCallback((id, evId, idx, field, value) => {
    setCustomEvals(prev => { const arr = [...(prev[id]?.[evId] || [])]; arr[idx] = { ...arr[idx], [field]: value }; return { ...prev, [id]: { ...prev[id], [evId]: arr } } }); scheduleSave(id)
  }, [scheduleSave])
  const removeCustomEval = useCallback((id, evId, idx) => {
    setCustomEvals(prev => { const arr = [...(prev[id]?.[evId] || [])]; arr.splice(idx, 1); return { ...prev, [id]: { ...prev[id], [evId]: arr } } }); scheduleSave(id)
  }, [scheduleSave])

  const toggleDoc = useCallback((id, docId) => {
    setDocState(prev => ({ ...prev, [id]: { ...prev[id], [docId]: !prev[id]?.[docId] } })); scheduleSave(id)
  }, [scheduleSave])

  const saveFormData = useCallback((id, docId, data) => {
    setFormData(prev => ({ ...prev, [id]: { ...prev[id], [docId]: data } })); scheduleSave(id)
  }, [scheduleSave])

  const signOffEmployee = useCallback((id) => {
    const emp = empRef.current[id] || employees.find(e => e.id === id); if (!emp) return
    const completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    setCompletedEmployees(prev => [...prev, { ...emp, status: 'completed', completedDate, completed_date: completedDate }])
    setEmployees(prev => prev.filter(e => e.id !== id))
    setOpenId(null)
    fetch(`/api/onboarding/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp: { status: 'completed', completed_date: completedDate } }) }).catch(() => {})
  }, [employees])

  return {
    employees, completedEmployees, openId, setOpenId, openPhase, setOpenPhase,
    taskState, customTasks, skillState, evalState, customEvals, docState,
    empPct, phasePct, empPhaseLabel,
    addEmployee, updateEmployee,
    toggleTask, setTaskStatus, selectAllTasks,
    addCustomTask, updateCustomTask, removeCustomTask,
    toggleSkill, setEval, setEvalNote,
    addCustomEval, updateCustomEval, removeCustomEval,
    toggleDoc, signOffEmployee, formData, saveFormData,
  }
}
