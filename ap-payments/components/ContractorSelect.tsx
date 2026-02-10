'use client';

import { APContractor } from '@/lib/supabase';

interface ContractorSelectProps {
  contractors: APContractor[];
  value: string | null;
  onChange: (contractorId: string | null) => void;
  disabled?: boolean;
}

export default function ContractorSelect({ contractors, value, onChange, disabled }: ContractorSelectProps) {
  return (
    <select
      className="select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
    >
      <option value="">Select contractor...</option>
      {contractors.filter(c => c.is_active).map((contractor) => (
        <option key={contractor.id} value={contractor.id}>
          {contractor.name}
        </option>
      ))}
    </select>
  );
}
