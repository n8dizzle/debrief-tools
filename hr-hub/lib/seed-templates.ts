export interface SeedPhase {
  name: string;
  description: string;
  sort_order: number;
  relative_start_day: number;
  relative_end_day: number;
  steps: SeedStep[];
}

export interface SeedStep {
  title: string;
  description: string | null;
  guidance_text: string | null;
  responsible_role: 'recruiter' | 'hiring_manager' | 'leadership' | 'hr' | 'employee';
  relative_due_day: number;
  is_conditional: boolean;
  condition_label: string | null;
  sort_order: number;
}

export const BASE_TEMPLATE_NAME = 'Onboarding the Christmas Way';
export const BASE_TEMPLATE_DESCRIPTION =
  'Standard onboarding workflow for all new Christmas Air team members. 6 phases covering preboarding through 6-month check-in.';

export const BASE_TEMPLATE_PHASES: SeedPhase[] = [
  // ─── Phase 1: Preboarding ───────────────────────────────────────────
  {
    name: 'Preboarding',
    description:
      'Prepare everything before the new hire walks in the door. Covers paperwork, workspace setup, and team communication.',
    sort_order: 0,
    relative_start_day: -14,
    relative_end_day: -1,
    steps: [
      // Recruiter tasks (due day -14)
      {
        title: 'Confirm offer letter signed and returned',
        description:
          'Verify the signed offer letter has been received and filed in the employee record.',
        guidance_text:
          'Follow up within 48 hours if not returned. A quick phone call is more effective than another email.',
        responsible_role: 'recruiter',
        relative_due_day: -14,
        is_conditional: false,
        condition_label: null,
        sort_order: 0,
      },
      {
        title: 'Send welcome packet with company overview and first-day instructions',
        description:
          'Email or mail the welcome packet including company overview, parking info, dress code, and what to bring on Day 1.',
        guidance_text:
          'Include a personal note from the hiring manager. First impressions matter — make them feel excited before they even start.',
        responsible_role: 'recruiter',
        relative_due_day: -14,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },
      {
        title: 'Coordinate with HR on background check completion',
        description:
          'Confirm background check has been initiated and track completion status with HR.',
        guidance_text: null,
        responsible_role: 'recruiter',
        relative_due_day: -14,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },

      // Hiring Manager tasks (due day -10)
      {
        title: 'Prepare workspace/truck/equipment assignment',
        description:
          'Set up the physical workspace, assign a vehicle if applicable, and gather all necessary equipment.',
        guidance_text:
          'Having everything ready on Day 1 shows the new hire they are expected and valued. Nothing worse than scrambling for a desk or truck.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 3,
      },
      {
        title: 'Create training schedule for first two weeks',
        description:
          'Build a day-by-day training plan covering skills, systems, and introductions for the first two weeks.',
        guidance_text:
          'Balance structured training with breathing room. Avoid back-to-back sessions all day — new hires need time to absorb.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 4,
      },
      {
        title: 'Identify onboarding buddy/mentor for new hire',
        description:
          'Select an experienced team member to serve as the new hire\'s go-to person during onboarding.',
        guidance_text:
          'Pick someone patient and positive — not just the most senior person. The buddy should be accessible and willing to answer "dumb" questions.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 5,
      },
      {
        title: 'Notify team of new hire joining and start date',
        description:
          'Send a team announcement with the new hire\'s name, role, start date, and brief background.',
        guidance_text:
          'Share enough context that the team can make the new hire feel welcome. Include their name, role, and something personal if the new hire is comfortable with it.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 6,
      },
      {
        title: 'Review job description and key responsibilities',
        description:
          'Re-read the job description to ensure training plan aligns with the role\'s actual responsibilities.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 7,
      },
      {
        title: 'Prepare list of key contacts and introductions',
        description:
          'Create a list of people the new hire should meet during their first week, with names, roles, and context.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 8,
      },
      {
        title: 'Set up initial 1-on-1 meeting schedule',
        description:
          'Block recurring 1-on-1 time on the calendar for at least the first month.',
        guidance_text:
          'Daily 15-minute check-ins during week 1, then transition to 2-3 times per week. Keep them informal and focused on support, not evaluation.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: false,
        condition_label: null,
        sort_order: 9,
      },
      {
        title: 'Order any specialized tools or equipment',
        description:
          'Order role-specific tools, gauges, PPE, or specialized equipment that may have lead time.',
        guidance_text:
          'Check with the outgoing employee or a current team member for a complete tool list. Some items have 1-2 week lead times.',
        responsible_role: 'hiring_manager',
        relative_due_day: -10,
        is_conditional: true,
        condition_label: 'If field role',
        sort_order: 10,
      },

      // Leadership tasks (due day -7)
      {
        title: 'Send personal welcome message or call to new hire',
        description:
          'Reach out personally to welcome the new hire and express excitement about them joining the team.',
        guidance_text:
          'A 2-minute phone call from a leader has an outsized impact. Keep it warm and brief — welcome them, say you\'re excited, and let them know the team is ready for them.',
        responsible_role: 'leadership',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 11,
      },
      {
        title: 'Schedule leadership meet-and-greet for first week',
        description:
          'Block time during the new hire\'s first week for an informal meeting with leadership.',
        guidance_text: null,
        responsible_role: 'leadership',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 12,
      },
      {
        title: 'Review and approve training plan',
        description:
          'Review the hiring manager\'s two-week training plan and provide feedback or approval.',
        guidance_text: null,
        responsible_role: 'leadership',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 13,
      },

      // HR tasks (due day -7)
      {
        title: 'Initiate background check and drug screening',
        description:
          'Submit background check and drug screening requests through the appropriate vendor.',
        guidance_text:
          'Start this as early as possible — results can take 3-7 business days. Do not allow start date before clearance.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 14,
      },
      {
        title: 'Prepare new hire paperwork (I-9, W-4, state tax forms)',
        description:
          'Assemble all required federal and state employment forms for Day 1 completion.',
        guidance_text:
          'Pre-fill what you can (company info, job title, start date) to minimize the new hire\'s paperwork burden on Day 1.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 15,
      },
      {
        title: 'Set up payroll and benefits enrollment',
        description:
          'Create the employee in the payroll system and prepare benefits enrollment materials.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 16,
      },
      {
        title: 'Create employee record in ServiceTitan',
        description:
          'Set up the new hire as a technician/dispatcher in ServiceTitan with appropriate permissions.',
        guidance_text:
          'Coordinate with the hiring manager on which business units and job types the new hire should have access to.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: true,
        condition_label: 'If field role',
        sort_order: 17,
      },
      {
        title: 'Order uniforms and company apparel',
        description:
          'Place uniform order with correct sizes and coordinate delivery before or on start date.',
        guidance_text:
          'Get sizes during the offer stage if possible. Having uniforms ready on Day 1 is a big morale boost.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 18,
      },
      {
        title: 'Set up company email and system access',
        description:
          'Create company email account and provision access to all required systems and tools.',
        guidance_text:
          'Use the standard naming convention (first.last@christmasair.com). Set up accounts for email, Slack, and any role-specific software.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 19,
      },
      {
        title: 'Prepare building access card/keys',
        description:
          'Program a building access card or cut keys for the new hire.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 20,
      },
      {
        title: 'Schedule orientation session',
        description:
          'Book the orientation room and confirm the Day 1 schedule with all participants.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 21,
      },
      {
        title: 'Verify all compliance documents are ready',
        description:
          'Final check that all required compliance documents, training materials, and acknowledgment forms are prepared.',
        guidance_text:
          'Use the compliance checklist to verify nothing is missed. Incomplete paperwork on Day 1 creates a poor first impression.',
        responsible_role: 'hr',
        relative_due_day: -7,
        is_conditional: false,
        condition_label: null,
        sort_order: 22,
      },
    ],
  },

  // ─── Phase 2: First Day ─────────────────────────────────────────────
  {
    name: 'First Day',
    description:
      'Make a great first impression. Complete required paperwork, introduce the team, and set the tone for the Christmas Way.',
    sort_order: 1,
    relative_start_day: 0,
    relative_end_day: 0,
    steps: [
      // Hiring Manager tasks (due day 0)
      {
        title: 'Welcome new hire and give facility tour',
        description:
          'Greet the new hire at the door, walk them through the facility, and show them all key areas.',
        guidance_text:
          'Be at the door when they arrive — don\'t make them wait in a lobby. Show restrooms, break room, parking, and their workspace. Keep the energy warm and upbeat.',
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 0,
      },
      {
        title: 'Introduce to immediate team members',
        description:
          'Walk the new hire around and personally introduce them to each team member.',
        guidance_text:
          'Share a brief context about each person\'s role. Help the new hire remember names by keeping introductions small and spaced out.',
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },
      {
        title: 'Review first week schedule and expectations',
        description:
          'Walk through the printed or digital schedule for the first week, explaining what each day will look like.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },
      {
        title: 'Walk through daily routines and processes',
        description:
          'Explain the typical daily workflow: start time, morning huddle, dispatching, end-of-day procedures.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 3,
      },
      {
        title: 'Explain communication tools and channels (Slack, email)',
        description:
          'Show how the team communicates day-to-day, which Slack channels to join, and email expectations.',
        guidance_text:
          'Help them send their first Slack message to the team channel — breaks the ice and confirms their account works.',
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 4,
      },
      {
        title: 'Show where to find supplies and resources',
        description:
          'Point out supply rooms, tool cribs, parts inventory, and how to request what they need.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 5,
      },
      {
        title: 'Take new hire to lunch or arrange team lunch',
        description:
          'Ensure the new hire has lunch plans — either a team lunch or a meal with the hiring manager and buddy.',
        guidance_text:
          'Nobody should eat alone on Day 1. A casual lunch is the best way to build rapport outside the formal onboarding.',
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 6,
      },
      {
        title: 'End-of-day check-in: answer questions, confirm Day 2 plan',
        description:
          'Sit down for 15 minutes at the end of the day to answer questions and preview tomorrow.',
        guidance_text:
          'Ask open-ended questions: "What surprised you today?" and "What are you most unsure about?" This builds trust early.',
        responsible_role: 'hiring_manager',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 7,
      },

      // Leadership tasks (due day 0)
      {
        title: 'Brief welcome address or video message',
        description:
          'Deliver a short in-person or recorded welcome from company leadership.',
        guidance_text:
          'Keep it under 5 minutes. Be genuine — share why you love working here and what makes Christmas Air special.',
        responsible_role: 'leadership',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 8,
      },
      {
        title: 'Share company mission, vision, and values',
        description:
          'Present the company\'s mission, vision, and core values with real examples of how they play out daily.',
        guidance_text: null,
        responsible_role: 'leadership',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 9,
      },
      {
        title: 'Explain the "Christmas Way" culture and expectations',
        description:
          'Walk through what it means to do things the Christmas Way — the standards, attitude, and commitment to excellence.',
        guidance_text:
          'Use specific stories and examples. Abstract values don\'t stick — real stories about team members living the values do.',
        responsible_role: 'leadership',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 10,
      },
      {
        title: 'Answer questions about growth and career paths',
        description:
          'Share how team members have grown within the company and what career paths are available.',
        guidance_text: null,
        responsible_role: 'leadership',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 11,
      },

      // HR tasks (due day 0)
      {
        title: 'Complete I-9 verification and all required paperwork',
        description:
          'Verify identity documents, complete I-9, and process all remaining employment forms.',
        guidance_text:
          'I-9 Section 2 must be completed by the end of the third business day. Acceptable documents list should be provided in advance so the new hire brings the right IDs.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 12,
      },
      {
        title: 'Review employee handbook and key policies',
        description:
          'Walk through the employee handbook, highlighting the most important policies and where to find answers.',
        guidance_text:
          'Don\'t read the whole handbook aloud. Hit the highlights and make sure they know where to find it later.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 13,
      },
      {
        title: 'Explain benefits package and enrollment deadlines',
        description:
          'Review health, dental, vision, 401k, and other benefits with enrollment timelines.',
        guidance_text:
          'Emphasize enrollment deadlines — missing the window means waiting until open enrollment. Provide a benefits summary sheet to take home.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 14,
      },
      {
        title: 'Set up direct deposit and payroll information',
        description:
          'Collect banking information and complete direct deposit enrollment.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 15,
      },
      {
        title: 'Issue employee ID and building access',
        description:
          'Provide employee ID badge and activate building access card/keys.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 16,
      },
      {
        title: 'Review safety protocols and emergency procedures',
        description:
          'Cover workplace safety rules, emergency exits, fire extinguisher locations, and evacuation procedures.',
        guidance_text:
          'Walk them to the actual emergency exits and assembly point. Pointing at a map is not enough.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 17,
      },
      {
        title: 'Complete harassment prevention training overview',
        description:
          'Deliver or assign the required harassment prevention training module.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 18,
      },
      {
        title: 'Explain PTO policy and time-off request process',
        description:
          'Review PTO accrual, request procedures, blackout periods, and how to submit time-off requests.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 19,
      },
      {
        title: 'Review dress code and appearance standards',
        description:
          'Explain uniform requirements, grooming standards, and any role-specific appearance guidelines.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 20,
      },
      {
        title: 'Provide IT equipment (laptop, phone) and credentials',
        description:
          'Issue company devices, walk through login process, and verify all accounts are working.',
        guidance_text:
          'Test everything in front of them. Nothing kills momentum like spending Day 2 troubleshooting a locked account.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 21,
      },
      {
        title: 'Walk through company intranet and key systems',
        description:
          'Demo the internal portal, key bookmarks, and how to find information and forms.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 22,
      },
      {
        title: 'Explain parking, break rooms, and facility amenities',
        description:
          'Cover practical day-to-day details: where to park, break room etiquette, vending, fridge policy.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 23,
      },
      {
        title: 'Review workers compensation and injury reporting',
        description:
          'Explain what to do in case of a workplace injury and how to file a workers comp claim.',
        guidance_text:
          'Stress the importance of reporting injuries immediately, no matter how minor. Late reporting creates complications.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 24,
      },
      {
        title: 'Administer any required compliance acknowledgments',
        description:
          'Have the new hire sign all required policy acknowledgments and compliance forms.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 25,
      },
      {
        title: 'Schedule follow-up meetings for benefits enrollment',
        description:
          'Book time within the enrollment window to help finalize benefits selections.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 26,
      },
      {
        title: 'Explain performance review process and timeline',
        description:
          'Preview when performance reviews happen and what the evaluation criteria look like.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 27,
      },
      {
        title: 'Review cell phone and technology use policies',
        description:
          'Cover acceptable use of company and personal devices during work hours.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 28,
      },
      {
        title: 'Complete new hire orientation checklist',
        description:
          'Final walkthrough of the orientation checklist to ensure nothing was missed.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 29,
      },
      {
        title: 'Take employee photo for company directory',
        description:
          'Take a professional photo for the employee directory and internal systems.',
        guidance_text:
          'Give them a heads up in the welcome packet so they can be prepared. Use a clean background and good lighting.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 30,
      },
      {
        title: 'Provide emergency contact form',
        description:
          'Collect emergency contact information and any relevant medical/allergy details.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: false,
        condition_label: null,
        sort_order: 31,
      },
      {
        title: 'Review company vehicle policy',
        description:
          'Go over vehicle use policy, fuel cards, maintenance reporting, and mileage tracking.',
        guidance_text:
          'Verify their driver\'s license is valid and on file. Review the accident reporting procedure thoroughly.',
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: true,
        condition_label: 'If driving role',
        sort_order: 32,
      },
      {
        title: 'Complete fleet safety acknowledgment',
        description:
          'Have the new hire review and sign the fleet safety policy and driving record consent.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 0,
        is_conditional: true,
        condition_label: 'If driving role',
        sort_order: 33,
      },
    ],
  },

  // ─── Phase 3: Day 2-7 ───────────────────────────────────────────────
  {
    name: 'Day 2-7',
    description:
      'Hands-on training begins. New hire shadows experienced team members, learns systems, and starts building skills.',
    sort_order: 2,
    relative_start_day: 1,
    relative_end_day: 6,
    steps: [
      // Hiring Manager tasks (due day 3)
      {
        title: 'Shadow experienced team member on job sites',
        description:
          'Pair the new hire with a senior technician to observe real jobs and learn field procedures.',
        guidance_text:
          'Brief the shadow partner beforehand — they should narrate what they\'re doing and why. The new hire should observe, ask questions, and take notes.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: true,
        condition_label: 'If field role',
        sort_order: 0,
      },
      {
        title: 'Begin hands-on training with mentor/buddy',
        description:
          'Start structured hands-on training sessions with the assigned onboarding buddy.',
        guidance_text:
          'Let them do things, not just watch. Supervised hands-on practice builds confidence faster than observation alone.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },
      {
        title: 'Review quality standards and workmanship expectations',
        description:
          'Walk through what "good work" looks like at Christmas Air — quality standards, documentation, and customer-facing presentation.',
        guidance_text:
          'Show before-and-after examples. Visual standards are clearer than written ones.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },
      {
        title: 'Practice using ServiceTitan for dispatching/job management',
        description:
          'Hands-on ServiceTitan training: navigating jobs, updating statuses, adding notes, uploading photos.',
        guidance_text:
          'Use a test/training job if possible. Let them click through the real interface rather than just watching a demo.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: true,
        condition_label: 'If field role',
        sort_order: 3,
      },
      {
        title: 'Introduction to key customers or accounts',
        description:
          'Introduce the new hire to important customer relationships and any account-specific protocols.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: false,
        condition_label: null,
        sort_order: 4,
      },
      {
        title: 'Daily end-of-day debrief and feedback sessions',
        description:
          'Hold a brief daily check-in to discuss what was learned, answer questions, and provide constructive feedback.',
        guidance_text:
          'Keep it positive and forward-looking. Ask what went well, what was confusing, and what they want to learn tomorrow.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: false,
        condition_label: null,
        sort_order: 5,
      },
      {
        title: 'Assess initial skill level and adjust training plan',
        description:
          'Evaluate the new hire\'s baseline skills after a few days and modify the training plan accordingly.',
        guidance_text:
          'Some new hires will be ahead of the plan, others behind. Adjust the pace — don\'t force everyone through the same timeline.',
        responsible_role: 'hiring_manager',
        relative_due_day: 3,
        is_conditional: false,
        condition_label: null,
        sort_order: 6,
      },

      // HR tasks (due day 5)
      {
        title: 'Follow up on benefits enrollment completion',
        description:
          'Check in to ensure the new hire has completed benefits enrollment before the deadline.',
        guidance_text:
          'A friendly reminder is better than a missed deadline. Offer to sit down and walk through options if they seem unsure.',
        responsible_role: 'hr',
        relative_due_day: 5,
        is_conditional: false,
        condition_label: null,
        sort_order: 7,
      },
    ],
  },

  // ─── Phase 4: Day 8-14 ──────────────────────────────────────────────
  {
    name: 'Day 8-14',
    description:
      'Transition from observation to supervised execution. New hire starts handling tasks with oversight and receives mid-training feedback.',
    sort_order: 3,
    relative_start_day: 7,
    relative_end_day: 13,
    steps: [
      // Hiring Manager tasks (due day 10)
      {
        title: 'First supervised independent job/task',
        description:
          'Allow the new hire to lead a job or task with the mentor observing and available for support.',
        guidance_text:
          'Choose an appropriate-difficulty job for their first solo attempt. Be nearby but let them take the lead. Debrief thoroughly afterward.',
        responsible_role: 'hiring_manager',
        relative_due_day: 10,
        is_conditional: true,
        condition_label: 'If field role',
        sort_order: 0,
      },
      {
        title: 'Mid-training progress review and feedback',
        description:
          'Formal sit-down to review progress against the training plan, celebrate wins, and address gaps.',
        guidance_text:
          'Be specific with feedback — "you did X well" is more useful than "good job." Document the conversation and any adjusted goals.',
        responsible_role: 'hiring_manager',
        relative_due_day: 10,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },

      // HR tasks (due day 10)
      {
        title: 'Verify all paperwork and compliance items complete',
        description:
          'Audit the new hire\'s file to ensure all required documents are signed, filed, and compliant.',
        guidance_text:
          'Check I-9 completion date compliance, signed handbook acknowledgment, completed training records, and benefits enrollment status.',
        responsible_role: 'hr',
        relative_due_day: 10,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },
    ],
  },

  // ─── Phase 5: Day 15-45 ─────────────────────────────────────────────
  {
    name: 'Day 15-45',
    description:
      'Building independence. Workload increases, cross-team exposure begins, and the 30-day milestone check-in happens.',
    sort_order: 4,
    relative_start_day: 14,
    relative_end_day: 44,
    steps: [
      // Hiring Manager tasks (due day 21)
      {
        title: 'Increase independent workload gradually',
        description:
          'Progressively reduce supervision as the new hire demonstrates competence and confidence.',
        guidance_text:
          'Increase complexity gradually — don\'t jump from easy jobs to the hardest ones. Monitor quality closely during this transition.',
        responsible_role: 'hiring_manager',
        relative_due_day: 21,
        is_conditional: false,
        condition_label: null,
        sort_order: 0,
      },
      {
        title: '30-day performance check-in',
        description:
          'Formal 30-day review covering performance, culture fit, areas of strength, and development needs.',
        guidance_text:
          'This is a critical milestone. Be honest but supportive. Document everything. If there are concerns, address them clearly with an improvement plan.',
        responsible_role: 'hiring_manager',
        relative_due_day: 21,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },
      {
        title: 'Review and update training goals',
        description:
          'Revisit the original training plan and set updated goals for the next 30 days based on progress.',
        guidance_text: null,
        responsible_role: 'hiring_manager',
        relative_due_day: 21,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },
      {
        title: 'Introduce to cross-department teams and workflows',
        description:
          'Broaden the new hire\'s understanding by connecting them with other departments they\'ll interact with.',
        guidance_text:
          'Schedule brief sit-downs with dispatch, warehouse, customer service, or other relevant teams so they understand how the pieces fit together.',
        responsible_role: 'hiring_manager',
        relative_due_day: 21,
        is_conditional: false,
        condition_label: null,
        sort_order: 3,
      },

      // HR tasks (due day 30)
      {
        title: '30-day new hire survey',
        description:
          'Send and collect the 30-day onboarding experience survey to gather feedback on the process.',
        guidance_text:
          'Keep it short (5-10 questions). Ask about their onboarding experience, what could be improved, and whether they have what they need to succeed.',
        responsible_role: 'hr',
        relative_due_day: 30,
        is_conditional: false,
        condition_label: null,
        sort_order: 4,
      },
      {
        title: 'Verify training hours and certifications logged',
        description:
          'Ensure all completed training hours and any earned certifications are properly documented.',
        guidance_text: null,
        responsible_role: 'hr',
        relative_due_day: 30,
        is_conditional: false,
        condition_label: null,
        sort_order: 5,
      },

      // Employee tasks (due day 30)
      {
        title: 'Complete 30-day self-assessment',
        description:
          'Fill out the 30-day self-assessment form reflecting on your onboarding experience, strengths, and areas for growth.',
        guidance_text:
          'Be honest and thoughtful. This is your chance to share what\'s going well and where you need more support. Your feedback helps us improve.',
        responsible_role: 'employee',
        relative_due_day: 30,
        is_conditional: false,
        condition_label: null,
        sort_order: 6,
      },
    ],
  },

  // ─── Phase 6: Day 46-6 Months ───────────────────────────────────────
  {
    name: 'Day 46-6 Months',
    description:
      'Long-term integration. Formal performance evaluations, career development planning, and transition to full team member.',
    sort_order: 5,
    relative_start_day: 45,
    relative_end_day: 180,
    steps: [
      // Hiring Manager tasks (due day 60)
      {
        title: '60-day performance review',
        description:
          'Conduct the 60-day performance review assessing progress, productivity, and culture integration.',
        guidance_text:
          'Compare against the 30-day review. Are gaps closing? Is confidence growing? Adjust support level based on trajectory.',
        responsible_role: 'hiring_manager',
        relative_due_day: 60,
        is_conditional: false,
        condition_label: null,
        sort_order: 0,
      },
      {
        title: '90-day formal performance evaluation',
        description:
          'Comprehensive 90-day evaluation covering all job responsibilities, quality of work, teamwork, and culture fit.',
        guidance_text:
          'This is typically the end of the probationary period. Be thorough and document clearly. Celebrate successes and set clear expectations for the next phase of their career.',
        responsible_role: 'hiring_manager',
        relative_due_day: 60,
        is_conditional: false,
        condition_label: null,
        sort_order: 1,
      },
      {
        title: 'Discuss career development plan and long-term goals',
        description:
          'Have a forward-looking conversation about career aspirations, growth opportunities, and long-term development at Christmas Air.',
        guidance_text:
          'Ask where they see themselves in 1-2 years. Share real examples of team members who have grown into new roles. Connect their goals to available opportunities.',
        responsible_role: 'hiring_manager',
        relative_due_day: 60,
        is_conditional: false,
        condition_label: null,
        sort_order: 2,
      },

      // Employee tasks (due day 90)
      {
        title: 'Complete 90-day self-assessment',
        description:
          'Fill out the 90-day self-assessment reflecting on your growth, accomplishments, and goals for the coming months.',
        guidance_text:
          'Think about how far you\'ve come since Day 1. Highlight specific accomplishments, skills you\'ve developed, and where you want to grow next.',
        responsible_role: 'employee',
        relative_due_day: 90,
        is_conditional: false,
        condition_label: null,
        sort_order: 3,
      },
    ],
  },
];
