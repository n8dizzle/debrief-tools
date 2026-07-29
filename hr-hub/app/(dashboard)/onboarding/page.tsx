export default function OnboardingPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Onboarding
      </h1>
      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
        The employee onboarding dashboard (phases, role checklists, evaluations, forms) built by the
        team is being folded into HR Hub. It currently lives as its own app while we port it into this
        tab — nothing has been removed.
      </p>
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          Onboarding File Cabinet — porting in progress
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          The onboarding tracker previously lived at this domain and is being folded into HR Hub as a
          full tab. Its source is preserved (<code>onboarding-dashboard</code>) and nothing has been
          deleted. This tab will host it directly once the port lands.
        </p>
      </div>
    </div>
  );
}
