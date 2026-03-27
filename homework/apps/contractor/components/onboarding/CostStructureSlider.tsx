'use client';

interface CostStructureSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  benchmark: string;
}

export default function CostStructureSlider({
  label,
  value,
  onChange,
  min,
  max,
  benchmark,
}: CostStructureSliderProps) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.375rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--hw-blue)', minWidth: '3rem', textAlign: 'right' }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          WebkitAppearance: 'none',
          appearance: 'none',
          borderRadius: '3px',
          background: `linear-gradient(to right, var(--hw-blue) 0%, var(--hw-blue) ${((value - min) / (max - min)) * 100}%, var(--border-default) ${((value - min) / (max - min)) * 100}%, var(--border-default) 100%)`,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        {benchmark}
      </div>
    </div>
  );
}
