'use client';

import { useCallback, useState } from 'react';

type PhaseType =
  | 'internal'
  | 'decision'
  | 'attorney'
  | 'collections'
  | 'legal'
  | 'resolved'
  | 'writeoff'
  | 'exception';

interface PhaseNodeData {
  id: string;
  phase: number;
  days: string;
  title: string;
  type: PhaseType;
  owner: string;
  summary: string;
  details: string[];
  next: string[];
  nextLabels?: string[];
}

const PHASES: PhaseNodeData[] = [
  {
    id: 'phase1',
    phase: 1,
    days: 'Days 1–3',
    title: 'Friendly Reminder',
    type: 'internal',
    owner: 'AR Team',
    summary: 'First contact — catch forgetful customers early.',
    details: [
      'Call or text within 1–3 days of service',
      'Warm, friendly tone — no pressure',
      '"Would you like to take care of that over the phone with a card?"',
      'Goal: resolve card declines, lost invoices, simple forgetfulness',
    ],
    next: ['phase2'],
  },
  {
    id: 'phase2',
    phase: 2,
    days: 'Days 4–14',
    title: 'Persistent Follow-Up',
    type: 'internal',
    owner: 'AR Team',
    summary: 'Multiple contacts + $25 late fee applied at Day 7.',
    details: [
      'Day 7: Second contact (call + text) — $25 LATE FEE APPLIED',
      'Day 10: Third contact (call + text + email with formal invoice)',
      'Text messages yield ~45% higher response than email',
      'Invoice must show: balance, service date, payment methods (CC / check / cash), late fee notice',
    ],
    next: ['phase3'],
  },
  {
    id: 'phase3',
    phase: 3,
    days: 'Days 15–30',
    title: 'Internal Escalation',
    type: 'internal',
    owner: 'AR Manager',
    summary: 'Get firm. Written notices. Suspend maintenance agreements.',
    details: [
      'Direct call from AR manager or office manager',
      'Formal written notice via email AND physical mail (certified if >$1,000)',
      'Reference the $25 late fee already applied',
      'State: "Account may be referred to our attorney or collections agency"',
      'Suspend any active maintenance agreements at Day 30',
      'No new work scheduled until balance is cleared',
    ],
    next: ['decision_dispute'],
  },
  {
    id: 'decision_dispute',
    phase: 3,
    days: 'Day 30',
    title: 'Workmanship Dispute?',
    type: 'decision',
    owner: 'AR Manager',
    summary: 'Check if the customer has a legitimate complaint about the work.',
    details: [
      'YES → Pause collections, route to Service Manager for resolution',
      'NO → Check for partial payment or payment plan',
    ],
    next: ['service_manager', 'decision_partial'],
    nextLabels: ['Yes — Dispute', 'No — Continue'],
  },
  {
    id: 'service_manager',
    phase: 3,
    days: 'Day 30+',
    title: 'Service Manager Review',
    type: 'exception',
    owner: 'Service Manager',
    summary: 'Resolve workmanship complaint before resuming collections.',
    details: [
      'Service manager inspects and evaluates the complaint',
      'If valid: schedule corrective work, then resume collections on remaining balance',
      'If invalid: document findings and resume collections process',
      'Collections clock pauses during review',
    ],
    next: [],
  },
  {
    id: 'decision_partial',
    phase: 3,
    days: 'Day 30',
    title: 'Partial Payment or Plan?',
    type: 'decision',
    owner: 'AR Manager',
    summary: 'Has the customer made a partial payment or credible promise?',
    details: [
      'YES → Extend to Day 45 with a documented payment plan',
      'NO → Proceed to third-party handoff (Phase 4)',
    ],
    next: ['phase4_fork'],
    nextLabels: ['No — Handoff'],
  },
  {
    id: 'phase4_fork',
    phase: 4,
    days: 'Days 31–45',
    title: 'Balance ≥ $500?',
    type: 'decision',
    owner: 'AR Manager',
    summary: 'Route to attorney or collections based on dollar amount.',
    details: [
      '≥ $500 → Attorney demand letter (20/month included in subscription)',
      '< $500 → Collections company',
      'If approaching 20-letter monthly cap, route $500–$750 to collections instead',
    ],
    next: ['route_attorney', 'route_collections'],
    nextLabels: ['≥ $500 → Attorney', '< $500 → Collections'],
  },
  {
    id: 'route_attorney',
    phase: 4,
    days: 'Days 31–45',
    title: 'Attorney Demand Letter',
    type: 'attorney',
    owner: 'Attorney',
    summary: 'Formal demand on attorney letterhead. 10–15 day deadline.',
    details: [
      'Sent on attorney letterhead',
      'States exact balance owed (including accrued late fees)',
      'References signed service agreement',
      'Sets 10–15 day hard payment deadline',
      "Warns of mechanic's lien, small claims court, or collections referral",
      'Monthly cap: 20 letters/month — prioritize higher balances',
    ],
    next: ['decision_attorney_response'],
  },
  {
    id: 'route_collections',
    phase: 4,
    days: 'Days 31–45',
    title: 'Collections Company',
    type: 'collections',
    owner: 'Collections Co.',
    summary: 'Hand off account with full documentation. Stop internal contact.',
    details: [
      'Provide: customer info, invoice copy, service date, contact attempt log',
      'Include accrued late fees in total balance',
      'Include signed service agreement if available',
      'STOP all direct customer contact — let collections handle it',
      'Collections agencies typically charge 10–25% contingency',
    ],
    next: ['phase7'],
  },
  {
    id: 'decision_attorney_response',
    phase: 5,
    days: 'Days 46–60',
    title: 'Payment Received?',
    type: 'decision',
    owner: 'AR Manager',
    summary: 'Evaluate response to attorney demand letter.',
    details: [
      'Most customers respond within 10–15 days of receiving the letter',
      'YES (paid or payment plan) → Close matter, reinstate maintenance agreement',
      'NO → Escalate based on balance amount',
    ],
    next: ['account_closed', 'decision_legal_escalation'],
    nextLabels: ['Yes — Paid', 'No — Escalate'],
  },
  {
    id: 'account_closed',
    phase: 5,
    days: '',
    title: 'Account Closed ✓',
    type: 'resolved',
    owner: '',
    summary: 'Payment received. Reinstate maintenance agreements.',
    details: [
      'Payment received in full (or payment plan established and active)',
      'Reinstate any suspended maintenance agreements',
      "Late fees may be waived for loyal customers at AR manager's discretion",
      'Document resolution in AR system',
    ],
    next: [],
  },
  {
    id: 'decision_legal_escalation',
    phase: 5,
    days: 'Day 60',
    title: 'Balance ≥ $1,500?',
    type: 'decision',
    owner: 'AR Manager',
    summary: 'Determine legal escalation path based on balance.',
    details: [
      "≥ $1,500 → Small claims court and/or mechanic's lien",
      '< $1,500 → Transfer to collections company (attorney letter created paper trail)',
    ],
    next: ['legal_action', 'route_collections_secondary'],
    nextLabels: ['≥ $1,500 → Legal', '< $1,500 → Collections'],
  },
  {
    id: 'legal_action',
    phase: 6,
    days: 'Days 61–90',
    title: 'Legal Action',
    type: 'legal',
    owner: 'Attorney',
    summary: "File in small claims court and/or mechanic's lien.",
    details: [
      'Small claims: Texas limit is $20,000 — low filing fees ($50–$100+)',
      "Mechanic's lien: must file by 15th of 3rd month after completion",
      'Lien blocks homeowner from selling or refinancing',
      'CAUTION: wrong filing triggers Fraudulent Lien Act ($10K+ damages)',
      'Attorney must review before any lien filing',
    ],
    next: ['phase7'],
  },
  {
    id: 'route_collections_secondary',
    phase: 5,
    days: 'Day 60+',
    title: 'Transfer to Collections',
    type: 'collections',
    owner: 'Collections Co.',
    summary: 'Attorney letter failed — hand off to collections with legal paper trail.',
    details: [
      'Attorney demand letter established documentation trail',
      'Include all prior correspondence in handoff package',
      'Collections company continues pursuit',
      'Stop internal contact',
    ],
    next: ['phase7'],
  },
  {
    id: 'phase7',
    phase: 7,
    days: '90+ Days',
    title: 'Resolution Decision',
    type: 'decision',
    owner: 'AR Manager',
    summary: "Make a final call — don't let accounts sit in limbo.",
    details: [
      'At 90 days: invoice worth ~87% of face value',
      'At 120 days: drops to ~33%',
      'Recovery drops ~1% per week past 90 days',
      "OPTIONS: Continue collections | File in court | Mechanic's lien | Write off",
      'DECIDE and move on — limbo is the worst outcome',
    ],
    next: ['write_off'],
    nextLabels: ['If exhausted'],
  },
  {
    id: 'write_off',
    phase: 7,
    days: '',
    title: 'Write Off',
    type: 'writeoff',
    owner: 'AR Manager',
    summary: 'All remedies exhausted. Document and close.',
    details: [
      'Balance too small to justify further effort',
      'Debtor unreachable or all remedies exhausted',
      'Document in AR system with full history',
      'Review quarterly — if write-offs exceed 3% of revenue, investigate root causes',
    ],
    next: [],
  },
];

const TYPE_STYLES: Record<PhaseType, { bg: string; border: string; accent: string; label: string }> = {
  internal: { bg: '#0D4F3C', border: '#1A7A5E', accent: '#34D399', label: 'Internal' },
  decision: { bg: '#5C3D0E', border: '#8B6914', accent: '#FBBF24', label: 'Decision' },
  attorney: { bg: '#4A2060', border: '#6B3090', accent: '#C084FC', label: 'Attorney' },
  collections: { bg: '#7C3A10', border: '#A85216', accent: '#FB923C', label: 'Collections' },
  legal: { bg: '#7F1D1D', border: '#AA2828', accent: '#F87171', label: 'Legal' },
  resolved: { bg: '#064E3B', border: '#059669', accent: '#6EE7B7', label: 'Resolved' },
  writeoff: { bg: '#374151', border: '#6B7280', accent: '#9CA3AF', label: 'Write-Off' },
  exception: { bg: '#1E3A5F', border: '#2D5A8E', accent: '#60A5FA', label: 'Exception' },
};

const ROUTING_TABLE = [
  { range: 'Under $500', action: 'Collections Company', fallback: 'Write off or small claims' },
  { range: '$500 – $1,499', action: 'Attorney Demand Letter', fallback: 'Collections company + small claims' },
  { range: '$1,500 – $4,999', action: 'Attorney Demand Letter', fallback: "Small claims + mechanic's lien" },
  { range: '$5,000+', action: 'Attorney Demand Letter', fallback: 'Attorney-led legal action + lien' },
];

const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace";

interface PhaseNodeProps {
  node: PhaseNodeData;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function PhaseNode({ node, isSelected, onClick }: PhaseNodeProps) {
  const style = TYPE_STYLES[node.type];
  return (
    <button
      onClick={() => onClick(node.id)}
      style={{
        background: isSelected ? style.border : style.bg,
        border: `2px solid ${isSelected ? style.accent : style.border}`,
        borderRadius: node.type === 'decision' ? 16 : 10,
        padding: '14px 18px',
        color: '#F9FAFB',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        position: 'relative',
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? `0 0 20px ${style.accent}33` : '0 2px 8px rgba(0,0,0,0.3)',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: style.accent,
            fontFamily: MONO,
          }}
        >
          {node.days}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: `${style.accent}22`,
            color: style.accent,
            padding: '2px 8px',
            borderRadius: 4,
            fontFamily: MONO,
          }}
        >
          {style.label}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{node.title}</div>
      <div style={{ fontSize: 12, color: '#D1D5DB', lineHeight: 1.4 }}>{node.summary}</div>
      {node.owner && (
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, fontFamily: MONO }}>Owner: {node.owner}</div>
      )}
    </button>
  );
}

interface DetailPanelProps {
  node: PhaseNodeData | null;
  onClose: () => void;
}

function DetailPanel({ node, onClose }: DetailPanelProps) {
  if (!node) return null;
  const style = TYPE_STYLES[node.type];
  return (
    <div
      style={{
        background: '#111827',
        border: `1px solid ${style.border}`,
        borderRadius: 12,
        padding: 24,
        position: 'relative',
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 ${style.accent}11`,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'transparent',
          border: 'none',
          color: '#6B7280',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
          padding: '4px 8px',
        }}
        aria-label="Close detail panel"
      >
        ×
      </button>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: style.accent,
          marginBottom: 4,
          fontFamily: MONO,
        }}
      >
        {style.label} {node.days ? `· ${node.days}` : ''}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{node.title}</div>
      {node.owner && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16, fontFamily: MONO }}>Owner: {node.owner}</div>
      )}
      <div style={{ borderTop: `1px solid ${style.border}`, paddingTop: 16 }}>
        {node.details.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{ color: style.accent, fontSize: 8, marginTop: 5, flexShrink: 0 }}>●</span>
            <span style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.5 }}>{d}</span>
          </div>
        ))}
      </div>
      {node.next && node.next.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${style.border}`, paddingTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: 8,
              fontFamily: MONO,
            }}
          >
            Next Steps
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {node.next.map((nId, i) => {
              const target = PHASES.find((p) => p.id === nId);
              if (!target) return null;
              const tStyle = TYPE_STYLES[target.type];
              return (
                <span
                  key={nId}
                  style={{
                    fontSize: 11,
                    color: tStyle.accent,
                    background: `${tStyle.accent}15`,
                    border: `1px solid ${tStyle.accent}33`,
                    padding: '3px 10px',
                    borderRadius: 6,
                  }}
                >
                  {node.nextLabels?.[i] ? `${node.nextLabels[i]}: ` : '→ '}
                  {target.title}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RoutingTable() {
  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 20, marginTop: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#FBBF24',
          marginBottom: 12,
          fontFamily: MONO,
        }}
      >
        Dollar-Based Routing Reference
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151' }}>
            {['Balance', 'Days 31–45 Action', 'If That Fails (Day 60+)'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: '#9CA3AF',
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: MONO,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROUTING_TABLE.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1F2937' }}>
              <td style={{ padding: '10px', color: '#F9FAFB', fontWeight: 600 }}>{row.range}</td>
              <td style={{ padding: '10px', color: '#D1D5DB' }}>{row.action}</td>
              <td style={{ padding: '10px', color: '#9CA3AF' }}>{row.fallback}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineBar() {
  const markers = [
    { day: 'Day 1', label: 'First Contact', color: '#34D399' },
    { day: 'Day 7', label: 'Late Fee', color: '#FBBF24' },
    { day: 'Day 14', label: '3rd Contact', color: '#34D399' },
    { day: 'Day 30', label: 'Get Firm', color: '#34D399' },
    { day: 'Day 45', label: 'Handoff', color: '#FB923C' },
    { day: 'Day 60', label: 'Evaluate', color: '#C084FC' },
    { day: 'Day 90', label: 'Decide', color: '#F87171' },
  ];
  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 20,
            right: 20,
            height: 2,
            background: 'linear-gradient(to right, #34D399, #FBBF24, #FB923C, #F87171)',
            opacity: 0.3,
          }}
        />
        {markers.map((m) => (
          <div key={m.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4, fontFamily: MONO }}>
              {m.label}
            </span>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: m.color,
                boxShadow: `0 0 8px ${m.color}55`,
                marginBottom: 4,
              }}
            />
            <span style={{ fontSize: 10, color: m.color, fontWeight: 700, fontFamily: MONO }}>{m.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
      {(Object.entries(TYPE_STYLES) as [PhaseType, typeof TYPE_STYLES[PhaseType]][]).map(([key, val]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: key === 'decision' ? 3 : 2, background: val.accent }} />
          <span
            style={{
              fontSize: 10,
              color: '#9CA3AF',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontFamily: MONO,
            }}
          >
            {val.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const MAIN_FLOW = ['phase1', 'phase2', 'phase3', 'decision_dispute', 'decision_partial', 'phase4_fork'];
const ATTORNEY_FLOW = ['route_attorney', 'decision_attorney_response', 'decision_legal_escalation'];
const COLLECTIONS_FLOW = ['route_collections'];
const RESOLUTION_FLOW = ['legal_action', 'route_collections_secondary', 'phase7', 'write_off'];
const SIDE_NODES = ['service_manager', 'account_closed'];

export default function ARCollectionsFlowchart() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedNode = PHASES.find((p) => p.id === selected) ?? null;

  const handleClick = useCallback((id: string) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  const renderColumn = (ids: string[], title: string) => (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#6B7280',
          marginBottom: 10,
          fontFamily: MONO,
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ids.map((id) => {
          const node = PHASES.find((p) => p.id === id);
          if (!node) return null;
          return (
            <div key={id}>
              <PhaseNode node={node} isSelected={selected === id} onClick={handleClick} />
              {node.next?.length > 0 && id !== ids[ids.length - 1] && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', color: '#4B5563', fontSize: 16 }}>↓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: '#0A0F1A',
        padding: '32px 24px',
        borderRadius: 16,
        border: '1px solid #1F2937',
      }}
    >
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6B7280',
            marginBottom: 6,
            fontFamily: MONO,
          }}
        >
          Christmas Air and Plumbing
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>AR Collections Process</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>Click any step to view details, actions, and next steps.</p>
      </div>

      <Legend />
      <TimelineBar />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {renderColumn(MAIN_FLOW, 'Phases 1–3 · Internal')}
        {renderColumn(ATTORNEY_FLOW, 'Phases 4–5 · Attorney Path')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderColumn(COLLECTIONS_FLOW, 'Phase 4 · Collections Path')}
          {renderColumn(SIDE_NODES, 'Outcomes')}
        </div>
        {renderColumn(RESOLUTION_FLOW, 'Phases 6–7 · Resolution')}
      </div>

      {selectedNode && (
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <DetailPanel node={selectedNode} onClose={() => setSelected(null)} />
        </div>
      )}

      <RoutingTable />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#FBBF24',
              marginBottom: 10,
              fontFamily: MONO,
            }}
          >
            Late Fee Schedule
          </div>
          <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7 }}>
            <div>
              <span style={{ color: '#FBBF24', fontWeight: 600 }}>Day 7:</span> $25 late fee applied
            </div>
            <div>
              <span style={{ color: '#FBBF24', fontWeight: 600 }}>Day 37:</span> Additional $25
            </div>
            <div>
              <span style={{ color: '#FBBF24', fontWeight: 600 }}>Day 67:</span> Additional $25
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>+$25 every 30 days thereafter</div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>Must be in signed service agreement before work begins</div>
          </div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#34D399',
              marginBottom: 10,
              fontFamily: MONO,
            }}
          >
            Payment Methods & Terms
          </div>
          <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7 }}>
            <div>
              <span style={{ color: '#34D399', fontWeight: 600 }}>Accepted:</span> Credit card, check, cash
            </div>
            <div>
              <span style={{ color: '#34D399', fontWeight: 600 }}>Terms:</span> Due at time of service
            </div>
            <div>
              <span style={{ color: '#34D399', fontWeight: 600 }}>Attorney letters:</span> 20/month (subscription)
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>No new work scheduled for customers with past-due balances</div>
          </div>
        </div>
      </div>
    </div>
  );
}
