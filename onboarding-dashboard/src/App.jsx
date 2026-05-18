import { useState, useCallback } from 'react'
import Dashboard from './components/Dashboard'
import ActiveFiles from './components/ActiveFiles'
import CompletedFiles from './components/CompletedFiles'
import EmployeeModal from './components/EmployeeModal'
import Resources from './components/Resources'
import JingleBills from './components/JingleBills'
import { useOnboarding } from './hooks/useOnboarding'
import './App.css'

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  // targetDept: when set, ActiveFiles will highlight/scroll to that cabinet
  const [targetDept, setTargetDept] = useState(null)
  const ob = useOnboarding()

  // Called from dashboard dept pills → switch to Active Files + highlight dept
  const handleGoToDept = useCallback((dept) => {
    setTargetDept(dept)
    setActiveView('active')
  }, [])

  // Called from calendar/upcoming → open that employee's file modal
  const handleOpenEmployee = useCallback((empId) => {
    ob.setOpenId(empId)
    ob.setOpenPhase(null)
  }, [ob])

  const openEmployee = ob.openId
    ? (ob.employees.find(e => e.id === ob.openId) || ob.completedEmployees.find(e => e.id === ob.openId))
    : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">C</div>
          <div>
            <div className="brand-name">Onboarding File Cabinet</div>
            <div className="brand-sub">Christmas Air, Plumbing &amp; Electrical</div>
          </div>
        </div>
        <nav className="nav-tabs">
          {[
            ['dashboard', 'Dashboard'],
            ['active',    'Active Files'],
            ['completed', 'Completed'],
            ['resources', 'Resources'],
            ['jinglebills', '⭐ Jingle Bills'],
          ].map(([v, l]) => (
            <button
              key={v}
              className={`tab-btn ${activeView === v ? 'active' : ''}`}
              onClick={() => setActiveView(v)}
            >{l}</button>
          ))}
        </nav>
      </header>

      <main>
        {activeView === 'dashboard' && (
          <Dashboard
            employees={ob.employees}
            completedEmployees={ob.completedEmployees}
            taskState={ob.taskState}
            skillState={ob.skillState}
            empPct={ob.empPct}
            onGoToDept={handleGoToDept}
            onOpenEmployee={handleOpenEmployee}
          />
        )}
        {activeView === 'active' && (
          <ActiveFiles
            employees={ob.employees}
            empPct={ob.empPct}
            empPhaseLabel={ob.empPhaseLabel}
            onOpen={id => { ob.setOpenId(id); ob.setOpenPhase(null) }}
            onAdd={ob.addEmployee}
            targetDept={targetDept}
            onTargetHandled={() => setTargetDept(null)}
          />
        )}
        {activeView === 'completed' && (
          <CompletedFiles
            completedEmployees={ob.completedEmployees}
            onOpenEmployee={id => { ob.setOpenId(id); ob.setOpenPhase(null) }}
          />
        )}
        {activeView === 'resources' && <Resources />}
        {activeView === 'jinglebills' && <JingleBills employees={ob.employees} />}
      </main>

      {openEmployee && (
        <EmployeeModal
          employee={openEmployee}
          taskState={ob.taskState[ob.openId] || {}}
          customTasks={ob.customTasks[ob.openId] || {}}
          skillState={ob.skillState[ob.openId] || {}}
          evalState={ob.evalState[ob.openId] || {}}
          customEvals={ob.customEvals[ob.openId] || {}}
          docState={ob.docState[ob.openId] || {}}
          empPct={ob.empPct}
          phasePct={ob.phasePct}
          initialPhase={ob.openPhase}
          onToggleTask={ob.toggleTask}
          onSetStatus={ob.setTaskStatus}
          onSelectAll={ob.selectAllTasks}
          onAddCustomTask={ob.addCustomTask}
          onUpdateCustomTask={ob.updateCustomTask}
          onRemoveCustomTask={ob.removeCustomTask}
          onToggleSkill={ob.toggleSkill}
          onSetEval={ob.setEval}
          onSetEvalNote={ob.setEvalNote}
          onAddCustomEval={ob.addCustomEval}
          onUpdateCustomEval={ob.updateCustomEval}
          onRemoveCustomEval={ob.removeCustomEval}
          onToggleDoc={ob.toggleDoc}
          formData={ob.formData[ob.openId] || {}}
          onSaveFormData={ob.saveFormData}
          onUpdateEmp={ob.updateEmployee}
          onSignOff={ob.signOffEmployee}
          onClose={() => { ob.setOpenId(null); ob.setOpenPhase(null) }}
          isCompleted={!!ob.completedEmployees.find(e => e.id === ob.openId)}
        />
      )}
    </div>
  )
}
