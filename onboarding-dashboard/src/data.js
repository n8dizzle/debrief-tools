// ─── Avatar palette ──────────────────────────────────────────────────────────
export const AVATAR_BG = ['#E6F1FB','#E1F5EE','#EEEDFE','#FAEEDA','#FAECE7','#EAF3DE','#FBEAF0']
export const AVATAR_TX = ['#0C447C','#085041','#3C3489','#633806','#712B13','#27500A','#72243E']

// ─── Departments ──────────────────────────────────────────────────────────────
export const DEPARTMENTS = ['HVAC-Service','HVAC-Install','Plumbing','Office/Admin','Warehouse','Sales']

export const DEPT_THEME = {
  // All use brand palette — sage green / deep green / maroon / gold variants
  'HVAC-Service': { tab:'#4e7c5f', tabTx:'#fff', body:'#edf5f0', stripe:'#a8cdb8', light:'#dff0e6', lightTx:'#2f5240' },
  'HVAC-Install': { tab:'#2f5240', tabTx:'#fff', body:'#e4eee8', stripe:'#7aaa90', light:'#d0e6d8', lightTx:'#1a3228' },
  'Plumbing':     { tab:'#6b8a7a', tabTx:'#fff', body:'#eaf0ec', stripe:'#b0c8bc', light:'#dceae2', lightTx:'#3a5248' },
  'Office/Admin': { tab:'#9a8a3a', tabTx:'#fff', body:'#f5f0da', stripe:'#c8b870', light:'#f0e8c0', lightTx:'#5a5020' },
  'Warehouse':    { tab:'#8b6040', tabTx:'#fff', body:'#f5ece4', stripe:'#c8a888', light:'#ecddd0', lightTx:'#5a3820' },
  'Sales':        { tab:'#8b2635', tabTx:'#fff', body:'#f5e8ea', stripe:'#c88898', light:'#eed8dc', lightTx:'#5a1820' },
}

// ─── Onboarding phases ────────────────────────────────────────────────────────
export const PHASES = [
  { id:'preboard',  label:'Pre-boarding',  short:'Pre-board' },
  { id:'day1',      label:'Day 1',         short:'Day 1'     },
  { id:'day2_7',    label:'Days 2–7',      short:'D2–7'      },
  { id:'day8_14',   label:'Days 8–14',     short:'D8–14'     },
  { id:'day15_45',  label:'Days 15–45',    short:'D15–45'    },
  { id:'day46_6m',  label:'Days 46–6 mo',  short:'D46–6m'    },
]

// ─── Tasks per phase (shared across all departments) ──────────────────────────
export const TASKS = {
  preboard: {
    Recruiter: [
      'Post job listing',
      'Phone screen candidate',
      'Set up interview with hiring manager',
    ],
    'Hiring Manager': [
      'Interview candidate',
      'Send offer letter with background check form',
      'Obtain signed & documented offer letter and contract',
      'Review background check',
      'Fill out Pre-Employment form for HR',
      'Inform team of new hire',
      'Set up training schedule',
      'Get truck / equipment ready (if applicable)',
    ],
    Leadership: [
      'Approve background check',
      'Accept Day 1 calendar invite',
      'Make copies of office keys (if applicable)',
    ],
    'Human Resources': [
      'Send welcome email (first day instructions, location, what to bring)',
      'Set up leadership Day 1 calendar request',
      'Create profiles in all internal systems',
      'Create usernames & temporary passwords',
      'Prepare new hire packet',
      'Configure hardware (laptop, tablet, phone)',
      'Set up Gmail (if applicable)',
      'Install & update required role software',
      'Get company shirts ready',
      'Add to Gusto',
      'Add to Slack',
      'Add to Wex (if applicable)',
      'Add to Planstin',
      'Add to Service Titan',
      'Add to auto insurance (if driver)',
      'Confirm pay type and rate',
      'Set work schedule and assign team',
    ],
  },
  day1: {
    'Human Resources': [
      'Finalize outstanding Gusto forms',
      'Give & review new hire packet',
      'Confirm system access: Gusto, Planstin, ST, Slack, Gmail, Bill, Wex',
      'Review pay policy',
      'Review at-will employment policy',
      'Review harassment policy',
      'Review PTO and holiday schedule',
      "Workman's Comp info & signature",
      'Explain medical/vision/dental benefits',
      'Explain 401K (100% match on first 4%)',
      'Sexual harassment training video',
      "Driver's safety training video (if applicable)",
      'Instruct on Slack & Gmail usage',
      'Share team directory',
      'Set up payroll',
      'Set up 45-day check-in calendar invite',
    ],
    Leadership: [
      'Introduce company mission, vision, and values',
      'Share company history & org structure',
      'Take new hire to lunch',
    ],
    'Hiring Manager': [
      'Set expectations for first week',
      'Provide "Christmas Way" overview for department',
      'Tour office, warehouse & key departments',
      'Assign department Slack channels',
      'Take picture for Service Titan',
      'Take new hire to lunch',
      'Detail role scope, responsibilities & KPIs',
    ],
  },
  day2_7: {
    'Human Resources': ['Complete any outstanding paperwork'],
    'Hiring Manager': [
      'Shadow seasoned colleague / ride-along',
      'Introduce new hire to entire team',
      'Cover workplace safety norms',
      'Review industry-specific regulations',
      'Discuss common customer interactions & challenges',
      'Outline first-month expectations',
    ],
  },
  day8_14: {
    'Human Resources': ['Schedule regular check-ins to provide support'],
    'Hiring Manager': [
      'Schedule regular check-ins',
      'Detail specific responsibilities, reporting structure & KPIs',
    ],
  },
  day15_45: {
    'Human Resources': [
      'Provide ongoing support for questions',
      'Verify software & tools still relevant to role',
    ],
    'Hiring Manager': [
      'Organize team-building activities',
      'Assign role-aligned training courses',
      'Define second-month goals',
      'Conduct 30-day manager review',
    ],
    Employee: ['Complete 30-day self-review'],
  },
  day46_6m: {
    'Hiring Manager': [
      'Set full-immersion objectives (Month 3+)',
      'Align with long-term company goals',
      'Prepare for first formal review',
    ],
  },
}

// ─── Department-specific skills ───────────────────────────────────────────────
export const DEPT_SKILLS = {
  'HVAC-Service': [
    { name:'Level 1 — Basics',       items:['Cooling tune-up (observation)','Heating tune-up (observation)','Capacitor','Contactor','Condensate drain line'] },
    { name:'Level 2 — Intermediate', items:['Thermostat / low voltage wiring','Outdoor fan motor','Indoor blower motor','Measure superheat / subcooling','Control board or relay','Pump down system'] },
    { name:'Level 3 — Advanced',     items:['Compressor diagnostics','Zoning (standard)','Heat pump operations','Gas furnace operations','Boiler operations','Brazing','Refrigerant leak detection','Evacuate system','Refrigerant recovery'] },
    { name:'Level 4–5 — Expert',     items:['Communicating systems','Advanced zoning','Ductwork / CFM','IAQ basics','AeroSeal','Attic insulation','Lead generation','Calculate heat loads','Present financing options','Paperwork proficiency'] },
  ],
  'HVAC-Install': [
    { name:'Level 1 — Basics',       items:['Cooling tune-up (observation)','Heating tune-up (observation)','Capacitor','Contactor','Condensate drain line'] },
    { name:'Level 2 — Intermediate', items:['Thermostat / low voltage wiring','Outdoor fan motor','Indoor blower motor','Measure superheat / subcooling','Control board or relay'] },
    { name:'Installation Skills',    items:['New system installation — split system','New system installation — package unit','Ductwork fabrication & installation','Electrical connections & whips','Refrigerant line sets','Pad & stand installation','Startup & commissioning','Customer walkthrough at completion'] },
    { name:'Level 4–5 — Expert',     items:['Communicating systems','Advanced zoning','Ductwork / CFM calculations','IAQ equipment','AeroSeal','Attic insulation','Heat load calculations','Paperwork & permits'] },
  ],
  'Plumbing': [
    { name:'Basic Service Skills',   items:['Water heater replacement','Faucet repair / replacement','Toilet repair / replacement','Drain cleaning','Under-sink repairs','Shut-off valve replacement'] },
    { name:'Intermediate Skills',    items:['Water line repair / replacement','Garbage disposal install','Tankless water heater','Sewer diagnosis','Camera inspection','Hydro-jetting basics'] },
    { name:'Advanced Skills',        items:['Sewer line replacement','Repipe (partial)','Repipe (full home)','Gas line work','Water softener installation','Backflow preventer'] },
    { name:'Customer & Sales',       items:['StraightForward Pricing presentation','Present repair options','Ask for the business','Club membership presentation','Customer communication','Paperwork & invoicing'] },
  ],
  'Office/Admin': [
    { name:'Systems & Software',     items:['Service Titan — scheduling','Service Titan — invoicing','Service Titan — customer records','Gusto — payroll basics','Slack communication','Gmail / calendar management'] },
    { name:'Customer Service',       items:['Inbound call handling','Outbound follow-up calls','Customer complaint resolution','Booking & scheduling','Dispatch coordination','Review request process'] },
    { name:'Administrative',         items:['Filing & document management','Accounts payable basics','Purchase order processing','Inventory tracking','Reporting & data entry','HR document management'] },
  ],
  'Warehouse': [
    { name:'Warehouse Operations',   items:['Inventory receiving & check-in','Parts labeling & organization','Stock rotation & cycle counts','Order picking & staging','Shipping & receiving','Forklift / equipment safety'] },
    { name:'Fleet & Trucks',         items:['Vehicle inspection process','Parts van stocking','Wex card management','Truck inventory audits','Maintenance scheduling','Emergency parts coordination'] },
    { name:'Systems',                items:['Service Titan — parts management','Inventory software basics','Purchasing & reorder process','Vendor communication','Returns & warranty claims'] },
  ],
  'Sales': [
    { name:'Product Knowledge',      items:['HVAC system types & terminology','Plumbing service offerings','Financing options & programs','Warranty & guarantee knowledge','Competitor awareness','Seasonal promotions'] },
    { name:'Sales Process',          items:['Lead qualification','Needs assessment & discovery','Proposal presentation','StraightForward Pricing® guide','Objection handling','Closing techniques'] },
    { name:'Customer Management',    items:['CRM usage (Service Titan)','Follow-up cadence','Club membership sales','Referral program','Customer retention','Pipeline management'] },
    { name:'Metrics & Goals',        items:['Revenue targets','Conversion rate tracking','Average ticket value','Club memberships sold','Customer satisfaction scores','Weekly reporting'] },
  ],
}

// ─── Evaluations ──────────────────────────────────────────────────────────────
export const DEPT_EVALS = {
  'HVAC-Service': [
    { id:'e30',  title:'30-Day Review',  skills:['Technical knowledge','Safety compliance','Customer communication','Punctuality & attendance','Teamwork'] },
    { id:'e6mo', title:'6-Month Review', skills:['Technical proficiency','Service revenue','Maintenance revenue','Options per opportunity','Customer satisfaction'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Technical mastery','Revenue contribution','Leadership potential','Professional growth'] },
  ],
  'HVAC-Install': [
    { id:'e30',  title:'30-Day Review',  skills:['Installation quality','Safety compliance','Team collaboration','Punctuality & attendance','Tool & equipment care'] },
    { id:'e6mo', title:'6-Month Review', skills:['Installation proficiency','Job completion rate','Callbacks / rework rate','Customer satisfaction','Efficiency & productivity'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Technical mastery','Quality of work','Leadership potential','Professional growth'] },
  ],
  'Plumbing': [
    { id:'e30',  title:'30-Day Review',  skills:['Technical knowledge','Safety compliance','Customer communication','Punctuality & attendance','Teamwork'] },
    { id:'e6mo', title:'6-Month Review', skills:['Technical proficiency','Service revenue','Upsell performance','Customer satisfaction','Callbacks / rework rate'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Technical mastery','Revenue contribution','Leadership potential','Professional growth'] },
  ],
  'Office/Admin': [
    { id:'e30',  title:'30-Day Review',  skills:['System proficiency','Customer communication','Accuracy & attention to detail','Punctuality & attendance','Team collaboration'] },
    { id:'e6mo', title:'6-Month Review', skills:['Productivity & efficiency','Customer satisfaction scores','Error rate','Process adherence','Initiative & problem solving'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Process mastery','Communication skills','Leadership potential','Professional growth'] },
  ],
  'Warehouse': [
    { id:'e30',  title:'30-Day Review',  skills:['Inventory accuracy','Safety compliance','Organizational skills','Punctuality & attendance','Team collaboration'] },
    { id:'e45',  title:'45-Day Review',  skills:['Receiving & check-in accuracy','Parts labeling & organization','Order picking speed & accuracy','Truck stocking compliance','Wex card & fleet procedures','Safety & equipment usage','Communication with dispatch & techs','Attitude & coachability'] },
    { id:'e6mo', title:'6-Month Review', skills:['Inventory accuracy rate','Order fulfillment speed','Safety record','Process adherence','Problem solving'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Operational mastery','Reliability','Leadership potential','Professional growth'] },
  ],
  'Sales': [
    { id:'e30',  title:'30-Day Review',  skills:['Product knowledge','Sales process adherence','Communication skills','Punctuality & attendance','Team collaboration'] },
    { id:'e6mo', title:'6-Month Review', skills:['Revenue vs. goal','Conversion rate','Average ticket value','Club memberships sold','Customer satisfaction'] },
    { id:'e1yr', title:'1-Year Review',  skills:['Overall performance','Revenue contribution','Sales mastery','Leadership potential','Professional growth'] },
  ],
}

// ─── Documents per department ─────────────────────────────────────────────────
export const DEPT_DOCS = {
  'HVAC-Service': [
    { id:'jd',        name:'Job Description (signed)',              type:'doc' },
    { id:'hvac',      name:'HVAC Week 1–2 Training Checklist',     type:'form', formFile:'hvac-training-checklist.html' },
    { id:'scc',       name:'Service Call Checklist',               type:'form', formFile:'service-call-checklist.html' },
    { id:'svc-score', name:'Service Essentials Scorecard — HVAC',  type:'pdf',  pdfKey:'hvac_scorecard' },
  ],
  'HVAC-Install': [
    { id:'jd',        name:'Job Description (signed)',              type:'doc' },
    { id:'hvac',      name:'HVAC Week 1–2 Training Checklist',     type:'form', formFile:'hvac-training-checklist.html' },
    { id:'scc',       name:'Service Call Checklist',               type:'form', formFile:'service-call-checklist.html' },
    { id:'svc-score', name:'Service Essentials Scorecard — HVAC',  type:'pdf',  pdfKey:'hvac_scorecard' },
  ],
  'Plumbing': [
    { id:'jd',    name:'Job Description (signed)',          type:'doc' },
    { id:'scc',   name:'Service Call Checklist',           type:'form', formFile:'service-call-checklist.html' },
  ],
  'Office/Admin': [
    { id:'jd',    name:'Job Description (signed)',          type:'doc' },
  ],
  'Warehouse': [
    { id:'jd',          name:'Job Description (signed)',               type:'doc' },
    { id:'wh-perf',     name:'Warehouse Performance Evaluation Form',  type:'pdf', pdfKey:'warehouse_eval' },
  ],
  'Sales': [
    { id:'jd',    name:'Job Description (signed)',          type:'doc' },
    { id:'scc',   name:'Service Call Checklist',           type:'form', formFile:'service-call-checklist.html' },
  ],
}

// ─── Forms library (dashboard) ────────────────────────────────────────────────
export const FORM_FOLDERS = [
  {
    id:'ff-hvac',
    name:'HVAC Training Forms',
    icon:'🔧',
    color:'#c07010',
    colorLight:'#fdf6e3',
    dept:['HVAC-Service','HVAC-Install'],
    forms:[
      { id:'hvac-training', name:'Week 1 & 2 Technical Training Checklist', desc:'Skill sign-off for new HVAC technicians — Levels 1 & 2', file:'hvac-training-checklist.html' },
      { id:'svc-call',      name:'Service Call Checklist',                  desc:'Ride-along evaluation form — all service call steps', file:'service-call-checklist.html' },
    ],
  },
  {
    id:'ff-plumbing',
    name:'Plumbing Forms',
    icon:'🔩',
    color:'#1a6b8a',
    colorLight:'#e3f4f8',
    dept:['Plumbing'],
    forms:[
      { id:'plumbing-scc', name:'Service Call Checklist', desc:'Ride-along evaluation for plumbing technicians', file:'service-call-checklist.html' },
    ],
  },
  {
    id:'ff-hr',
    name:'HR & Onboarding Forms',
    icon:'📋',
    color:'#1a5c35',
    colorLight:'#e8f6ee',
    dept:'all',
    forms:[
      { id:'pre-hire',  name:'Pre-Hire Checklist',  desc:'Before onboarding — offer, background, hardware setup', file:null, fields:[
        { id:'candidateName', label:'Candidate Name', type:'text' },
        { id:'position',      label:'Position',       type:'text' },
        { id:'hiringMgr',     label:'Hiring Manager', type:'text' },
        { id:'startDate',     label:'Start Date',     type:'date' },
        { id:'offerSigned',   label:'Offer letter signed and returned', type:'check' },
        { id:'bgCheck',       label:'Background check processed and passed', type:'check' },
        { id:'jobDescSigned', label:'Signed job description provided to HR', type:'check' },
        { id:'payType',       label:'Pay type (Hourly / Salary / Commission)', type:'text' },
        { id:'shirts',        label:'Work shirts ready', type:'check' },
        { id:'mentorAssigned',label:'Mentor or trainer assigned', type:'check' },
        { id:'firstDayAgenda',label:'Manager prepared first-day agenda', type:'check' },
        { id:'teamNotified',  label:'Team notified of new hire', type:'check' },
      ]},
      { id:'day1',      name:'Day 1 Checklist',     desc:'System access confirmation, policies, and payroll setup', file:null, fields:[
        { id:'empName',    label:'Employee Name',    type:'text' },
        { id:'date',       label:'Date',             type:'date' },
        { id:'gusto',      label:'Gusto access confirmed', type:'check' },
        { id:'planstin',   label:'Planstin access confirmed', type:'check' },
        { id:'st',         label:'Service Titan access confirmed', type:'check' },
        { id:'slack',      label:'Slack access confirmed', type:'check' },
        { id:'payPolicy',  label:'Pay policy reviewed & signed', type:'check' },
        { id:'harassment', label:'Harassment policy reviewed & signed', type:'check' },
        { id:'pto',        label:'PTO policy reviewed & signed', type:'check' },
        { id:'benefits',   label:'Benefits explained (healthcare, 401K)', type:'check' },
        { id:'harVideo',   label:'Sexual harassment training video watched', type:'check' },
        { id:'payrollSetup',label:'Employee set up with payroll', type:'check' },
        { id:'cal45',      label:'45-day calendar invite sent', type:'check' },
      ]},
      { id:'review30',  name:'30-Day Review Form',  desc:'Manager and employee 30-day check-in', file:null, fields:[
        { id:'empName',   label:'Employee Name',   type:'text' },
        { id:'mgr',       label:'Manager Name',    type:'text' },
        { id:'reviewDate',label:'Review Date',     type:'date' },
        { id:'jobKnow',   label:'Job Knowledge (1–10)',    type:'number' },
        { id:'comm',      label:'Communication (1–10)',    type:'number' },
        { id:'team',      label:'Teamwork (1–10)',         type:'number' },
        { id:'custSvc',   label:'Customer Service (1–10)', type:'number' },
        { id:'attend',    label:'Attendance (1–10)',       type:'number' },
        { id:'mgrNotes',  label:'Manager Notes',           type:'textarea' },
        { id:'empNotes',  label:'Employee Notes / Concerns', type:'textarea' },
        { id:'goals',     label:'Goals for next 30 days',  type:'textarea' },
      ]},
    ],
  },
  {
    id:'ff-vehicle',
    name:'Vehicle & Equipment Forms',
    icon:'🚛',
    color:'#7a2e7a',
    colorLight:'#f5e8f5',
    dept:['HVAC-Service','HVAC-Install','Plumbing'],
    forms:[
      { id:'vehicle', name:'Vehicle Assignment & Inspection', desc:'Day 30 vehicle assignment, inspection, and card training', file:null, fields:[
        { id:'empName',   label:'Employee Name',    type:'text' },
        { id:'date',      label:'Date',             type:'date' },
        { id:'truckNum',  label:'Truck #',          type:'text' },
        { id:'miles',     label:'Odometer (miles)', type:'text' },
        { id:'inspBody',  label:'Body & exterior inspected',  type:'check' },
        { id:'inspTires', label:'Tires inspected',            type:'check' },
        { id:'stocked',   label:'Van stocked with supplies',  type:'check' },
        { id:'wexTrain',  label:'Wex card training complete', type:'check' },
        { id:'billTrain', label:'Bill card training complete',type:'check' },
        { id:'mgrSig',    label:'Manager Signature', type:'text' },
        { id:'empSig',    label:'Employee Signature', type:'text' },
      ]},
    ],
  },
]

// ─── Role badge map ───────────────────────────────────────────────────────────
export const ROLE_BADGE = {
  'Human Resources':'bhr', 'Hiring Manager':'bhm', Leadership:'bldr',
  Employee:'bemp', Recruiter:'brec',
}

// ─── Sample employees ─────────────────────────────────────────────────────────
export const SAMPLE_EMPLOYEES = [
  { name:'Jordan Mitchell', title:'HVAC Technician',  dept:'HVAC-Service', mgr:'Chris Medlock', start:'2025-01-13', type:'Full Time', phaseFill:[1,1,0.9,0.5,0.1,0] },
  { name:'Alexis Torres',   title:'Install Tech',     dept:'HVAC-Install', mgr:'Chris Medlock', start:'2025-02-24', type:'Full Time', phaseFill:[1,1,0.6,0.2,0,0]   },
  { name:'Sam Rivera',      title:'Office Manager',   dept:'Office/Admin', mgr:'Chris Medlock', start:'2025-03-10', type:'Full Time', phaseFill:[1,0.9,0.4,0,0,0]   },
  { name:'Casey Nguyen',    title:'Service Tech',     dept:'Plumbing',     mgr:'Chris Medlock', start:'2025-04-01', type:'Full Time', phaseFill:[1,0.6,0,0,0,0]     },
  { name:'Taylor Brooks',   title:'Warehouse Lead',   dept:'Warehouse',    mgr:'Chris Medlock', start:'2025-05-12', type:'Full Time', phaseFill:[0.8,0,0,0,0,0]     },
  { name:'Morgan Ellis',    title:'Sales Associate',  dept:'Sales',        mgr:'Chris Medlock', start:'2025-05-20', type:'Full Time', phaseFill:[0.5,0,0,0,0,0]     },
]
