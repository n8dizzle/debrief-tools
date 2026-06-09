import ARCollectionsFlowchart from '@/components/ARCollectionsFlowchart';

export const metadata = {
  title: 'Collections SOP · AR Collections',
};

const KPIS = [
  { metric: 'Days Sales Outstanding (DSO)', target: 'Under 15 days (residential)', how: 'Total AR ÷ average daily revenue' },
  { metric: 'Current AR (0–30 days)', target: '85%+ of total AR', how: 'Aging report' },
  { metric: '31–60 day AR', target: 'Under 10% of total AR', how: 'Aging report' },
  { metric: '90+ day AR', target: 'Under 5% of total AR', how: 'Aging report' },
  { metric: 'Collection rate on attorney letters', target: '70%+ paid within 15 days', how: 'Track outcomes per letter' },
  { metric: 'Collections company recovery rate', target: '30%+ of submitted balances', how: 'Quarterly review with agency' },
  { metric: 'Bad debt write-off rate', target: 'Under 3% of annual revenue', how: 'Quarterly financial review' },
  { metric: "Lien deadline compliance", target: '100% — never miss a filing window', how: 'AR manager tracks monthly' },
];

function SectionCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h2
        className="text-lg font-semibold mb-4"
        style={{
          color: accent ?? 'var(--christmas-cream)',
        }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </div>
    </section>
  );
}

export default function SOPPage() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="space-y-2">
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Standard Operating Procedure
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Collections SOP
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          The complete process for collecting on past-due residential HVAC and plumbing invoices. Click any step
          in the flowchart for detailed actions and ownership.
        </p>
      </header>

      <ARCollectionsFlowchart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Late Fee Policy">
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Structure:</strong> Flat $25 fee applied 7 days
            after service if unpaid. Additional $25 every 30 days thereafter until paid in full.
          </p>
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Legal basis:</strong> Must be included in the
            service agreement signed by the customer before work begins. Texas has no statutory cap on late fees
            for service businesses, but fees must be reasonable and disclosed in advance.
          </p>
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Technician responsibility:</strong> Ensure the
            customer signs the service agreement (which includes late fee language) before work begins on every
            job. No signature = no enforceable late fee.
          </p>
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Discretion to waive:</strong> AR manager may
            waive late fees for long-time maintenance customers experiencing genuine hardship (job loss, medical
            emergency, etc.). Waiver must be documented.
          </p>
          <div
            className="rounded-lg p-3 mt-3 text-xs"
            style={{
              backgroundColor: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <strong style={{ color: 'var(--christmas-cream)' }}>Service agreement language:</strong> "Payment
            is due at time of service. A late fee of $25 will be applied to any balance remaining unpaid 7 days
            after service, with an additional $25 assessed every 30 days thereafter until paid in full."
          </div>
        </SectionCard>

        <SectionCard title="Maintenance Agreement & Future Service Policy">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong style={{ color: 'var(--christmas-cream)' }}>Suspend at Day 30:</strong> Any active
              maintenance or service agreement is suspended when an account reaches 30 days past due.
            </li>
            <li>
              <strong style={{ color: 'var(--christmas-cream)' }}>No new work:</strong> Do not schedule any new
              service calls for a customer with an outstanding past-due balance, regardless of amount.
            </li>
            <li>
              <strong style={{ color: 'var(--christmas-cream)' }}>Reinstatement:</strong> Maintenance agreements
              are reinstated only after the past-due balance is paid in full.
            </li>
            <li>
              <strong style={{ color: 'var(--christmas-cream)' }}>Exception:</strong> Emergency safety
              situations (gas leak, carbon monoxide) are handled per applicable law and safety obligations, but
              payment for the new service must be collected at time of service with no exceptions.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Texas Legal Notes">
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Mechanic's Liens (Property Code Ch. 53):</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Residential deadline:</strong> File lien affidavit by the 15th day of the 3rd month after
              work completion.
            </li>
            <li>
              <strong>Lawsuit to foreclose:</strong> Must be filed within 1 year of the last day the lien could
              have been filed.
            </li>
            <li>
              <strong>Power of the lien:</strong> Homeowner cannot sell or refinance until the lien is resolved.
            </li>
            <li>
              <strong>Caution:</strong> Wrong filing triggers Texas Fraudulent Lien Act ($10K+ damages plus
              attorney fees). Attorney must review before filing.
            </li>
          </ul>
          <p className="mt-3">
            <strong style={{ color: 'var(--christmas-cream)' }}>Small Claims (Justice Court):</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Maximum claim: $20,000</li>
            <li>Filing fees: $50–$100+</li>
            <li>No attorney required — informal setting</li>
            <li>Useful for balances $1,500–$20,000 after attorney letter fails</li>
          </ul>
        </SectionCard>

        <SectionCard title="Monthly AR Review Cadence">
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Weekly (AR Manager):</strong> Review aging
            report. Identify accounts approaching the 30-day mark and ensure Phases 1–2 contacts are complete.
          </p>
          <p>
            <strong style={{ color: 'var(--christmas-cream)' }}>Monthly (1st business day):</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Review all accounts in the 31–90 day buckets</li>
            <li>Confirm third-party handoffs are made on schedule</li>
            <li>Count attorney letters used vs. the 20/month cap; adjust routing if approaching</li>
            <li>Review mechanic's lien deadlines approaching</li>
          </ul>
          <p className="mt-3">
            <strong style={{ color: 'var(--christmas-cream)' }}>Quarterly:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Review write-off totals — investigate root causes if &gt;3% of revenue</li>
            <li>Evaluate collections company performance (recovery rate, communication quality)</li>
            <li>Review attorney letter effectiveness (% paid within 15 days)</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Key Performance Metrics">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th
                  className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Metric
                </th>
                <th
                  className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Target
                </th>
                <th
                  className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  How to Measure
                </th>
              </tr>
            </thead>
            <tbody>
              {KPIS.map((row) => (
                <tr key={row.metric} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-2 py-3 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    {row.metric}
                  </td>
                  <td className="px-2 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {row.target}
                  </td>
                  <td className="px-2 py-3" style={{ color: 'var(--text-muted)' }}>
                    {row.how}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Reference: Industry Data the SOP Is Built On">
        <ul className="list-disc pl-5 space-y-1">
          <li>Recovery rates: 90–98% at 1–30 days; 75–85% at 31–60 days; 50–70% at 90 days; 15–30% at 6 months</li>
          <li>Invoice value: ~87% of face at 90 days; ~33% at 120 days</li>
          <li>Recovery probability drops ~1% per week past 90 days</li>
          <li>Text outreach yields ~45% higher response than email alone</li>
          <li>Collection agencies typically charge 10–25% contingency on recovered amounts</li>
          <li>Bad debt write-off benchmark for construction/contracting: 3–5% of revenue</li>
        </ul>
      </SectionCard>

      <footer
        className="text-center text-xs pt-4 pb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        Christmas Air and Plumbing · AR Collections SOP
      </footer>
    </div>
  );
}
