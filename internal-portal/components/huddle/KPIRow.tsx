'use client';

import { HuddleKPIWithData } from '@/lib/supabase';
import { formatKPIValue, statusBackgrounds } from '@/lib/huddle-utils';
import StatusBadge from './StatusBadge';
import NotesInput from './NotesInput';

interface KPIRowProps {
  kpi: HuddleKPIWithData;
  date: string;
  canEditNotes?: boolean;
  onNoteChange?: (kpiId: string, note: string) => void;
}

export default function KPIRow({
  kpi,
  date,
  canEditNotes = true,
  onNoteChange,
}: KPIRowProps) {
  const formattedTarget = formatKPIValue(kpi.target, kpi.format, kpi.unit);
  const formattedActual = formatKPIValue(kpi.actual, kpi.format, kpi.unit);

  return (
    <tr
      className="border-b transition-colors"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor: statusBackgrounds[kpi.status],
      }}
    >
      {/* KPI Name */}
      <td className="py-3 px-4">
        <span style={{ color: 'var(--text-primary)' }}>{kpi.name}</span>
      </td>

      {/* Target */}
      <td className="py-3 px-4 text-right">
        <span style={{ color: 'var(--text-secondary)' }}>{formattedTarget}</span>
      </td>

      {/* Actual */}
      <td className="py-3 px-4 text-right font-medium">
        <span style={{ color: 'var(--text-primary)' }}>{formattedActual}</span>
      </td>

      {/* % to Goal */}
      <td className="py-3 px-4 text-center">
        <StatusBadge status={kpi.status} percentToGoal={kpi.percent_to_goal} />
      </td>

      {/* Notes */}
      <td className="py-3 px-4">
        <NotesInput
          kpiId={kpi.id}
          date={date}
          initialValue={kpi.note}
          disabled={!canEditNotes}
          onSave={(value) => onNoteChange?.(kpi.id, value)}
        />
      </td>
    </tr>
  );
}
