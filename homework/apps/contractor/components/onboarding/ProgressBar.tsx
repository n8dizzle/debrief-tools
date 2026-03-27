'use client';

const STEPS = [
  'Business Profile',
  'Business Type',
  'Revenue Goals',
  'Service Areas',
  'Price Book',
];

interface ProgressBarProps {
  currentStep: number; // 2-6 (step 1 is signup, handled separately)
}

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  // Map wizard steps 2-6 to display positions 1-5
  const displayStep = currentStep - 1;

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem' }}>
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === displayStep;
          const isComplete = stepNum < displayStep;
          return (
            <div key={label} style={{ flex: 1 }}>
              <div
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  background: isComplete
                    ? 'var(--hw-blue)'
                    : isActive
                      ? 'var(--hw-blue-light)'
                      : 'var(--border-default)',
                  transition: 'background 0.3s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Step {displayStep} of {STEPS.length}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {STEPS[displayStep - 1] || ''}
        </span>
      </div>
    </div>
  );
}
