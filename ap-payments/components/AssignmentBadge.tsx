'use client';

import { APAssignmentType } from '@/lib/supabase';

const assignmentConfig: Record<APAssignmentType, { bg: string; text: string; label: string }> = {
  unassigned: { bg: 'rgba(107, 124, 110, 0.15)', text: '#6B7C6E', label: 'Unassigned' },
  in_house: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'In-House' },
  contractor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', label: 'Contractor' },
};

interface AssignmentBadgeProps {
  type: APAssignmentType;
}

export default function AssignmentBadge({ type }: AssignmentBadgeProps) {
  const config = assignmentConfig[type] || assignmentConfig.unassigned;

  return (
    <span
      className="badge"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}
