'use client';

import { Trade } from '@/lib/supabase';

interface ProgressBarProps {
  progress: number;
  trade: Trade;
}

export default function ProgressBar({ progress, trade }: ProgressBarProps) {
  const tradeColor = trade === 'hvac' ? '#5D8A66' : '#B8956B';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Progress</span>
        <span className="text-sm font-semibold" style={{ color: tradeColor }}>
          {progress}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: tradeColor,
          }}
        />
      </div>
    </div>
  );
}
