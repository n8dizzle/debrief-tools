'use client';

interface Phase {
  name: string;
  total: number;
  completed: number;
  hasOverdue: boolean;
  isCurrent: boolean;
}

interface PhaseProgressProps {
  phases: Phase[];
}

export default function PhaseProgress({ phases }: PhaseProgressProps) {
  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto pb-2">
      {phases.map((phase, i) => {
        const progress = phase.total > 0 ? phase.completed / phase.total : 0;
        const isComplete = progress === 1;
        const isStarted = progress > 0;

        let bgColor = 'var(--bg-card)'; // upcoming
        let borderColor = 'var(--border-subtle)';
        if (isComplete) {
          bgColor = 'rgba(34, 197, 94, 0.15)';
          borderColor = 'rgba(34, 197, 94, 0.3)';
        } else if (phase.isCurrent) {
          bgColor = 'rgba(59, 130, 246, 0.15)';
          borderColor = 'rgba(59, 130, 246, 0.3)';
        }
        if (phase.hasOverdue) {
          borderColor = 'var(--status-error)';
        }

        return (
          <div key={phase.name} className="flex items-center gap-1 flex-1 min-w-0">
            <div
              className="flex-1 rounded-lg p-2 text-center min-w-[80px]"
              style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
            >
              <div className="text-[10px] font-medium truncate" style={{
                color: isComplete ? '#4ade80' : phase.isCurrent ? '#60a5fa' : 'var(--text-muted)'
              }}>
                {phase.name}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {phase.completed}/{phase.total}
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 rounded-full mt-1" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div
                  className="h-1 rounded-full transition-all"
                  style={{
                    width: `${progress * 100}%`,
                    backgroundColor: isComplete ? '#22c55e' : phase.hasOverdue ? 'var(--status-error)' : '#3b82f6',
                  }}
                />
              </div>
            </div>
            {i < phases.length - 1 && (
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
