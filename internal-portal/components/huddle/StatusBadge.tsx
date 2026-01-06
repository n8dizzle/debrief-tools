'use client';

import { HuddleKPIStatus } from '@/lib/supabase';
import { statusColors, statusBackgrounds } from '@/lib/huddle-utils';

interface StatusBadgeProps {
  status: HuddleKPIStatus;
  percentToGoal?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, percentToGoal, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const displayText = percentToGoal !== null && percentToGoal !== undefined
    ? `${Math.round(percentToGoal)}%`
    : status === 'pending' ? '-' : status;

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-md ${sizeClasses[size]}`}
      style={{
        backgroundColor: statusBackgrounds[status],
        color: statusColors[status],
        minWidth: '60px',
      }}
    >
      {displayText}
    </span>
  );
}
