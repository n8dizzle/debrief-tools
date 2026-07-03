'use client';

import { useState } from 'react';

export type SystemType = 'ac-furnace' | 'heat-pump' | 'dual-fuel' | 'ac-only' | 'furnace-only';
export type HeatSource = 'gas' | 'electric' | 'none';

export interface SystemSetup {
  systemType: SystemType;
  tonnage: number;
  systemCount: number;
}

interface SystemConfigProps {
  onConfigure: (setup: SystemSetup) => void;
  initial?: SystemSetup;
}

const SYSTEM_TYPES: Array<{ value: SystemType; label: string; desc: string }> = [
  { value: 'ac-furnace', label: 'AC + Furnace', desc: 'Standard split system' },
  { value: 'heat-pump', label: 'Heat Pump', desc: 'All-electric heating & cooling' },
  { value: 'dual-fuel', label: 'Dual Fuel', desc: 'Heat pump + gas furnace backup' },
  { value: 'ac-only', label: 'AC Only', desc: 'Condenser replacement only' },
  { value: 'furnace-only', label: 'Furnace Only', desc: 'Furnace replacement only' },
];

const TONNAGES = [1.5, 2, 2.5, 3, 3.5, 4, 5];

export default function SystemConfig({ onConfigure, initial }: SystemConfigProps) {
  const [systemType, setSystemType] = useState<SystemType>(initial?.systemType || 'ac-furnace');
  const [tonnage, setTonnage] = useState<number>(initial?.tonnage || 3);
  const [systemCount, setSystemCount] = useState<number>(initial?.systemCount || 1);

  function handleContinue() {
    onConfigure({ systemType, tonnage, systemCount });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* System Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">What type of system?</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SYSTEM_TYPES.map(st => (
            <button
              key={st.value}
              onClick={() => setSystemType(st.value)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                systemType === st.value
                  ? 'border-[var(--christmas-green)] bg-green-50 ring-1 ring-[var(--christmas-green)]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900 text-sm">{st.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{st.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tonnage */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">What tonnage?</label>
        <div className="flex gap-2 flex-wrap">
          {TONNAGES.map(t => (
            <button
              key={t}
              onClick={() => setTonnage(t)}
              className={`px-5 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                tonnage === t
                  ? 'border-[var(--christmas-green)] bg-green-50 text-[var(--christmas-green)] ring-1 ring-[var(--christmas-green)]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {t} Ton
            </button>
          ))}
        </div>
      </div>

      {/* System Count */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">How many systems?</label>
        <div className="flex gap-2">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setSystemCount(n)}
              className={`px-6 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                systemCount === n
                  ? 'border-[var(--christmas-green)] bg-green-50 text-[var(--christmas-green)] ring-1 ring-[var(--christmas-green)]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {n} System{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Continue */}
      <div className="pt-2">
        <button
          onClick={handleContinue}
          className="w-full py-3 bg-[var(--christmas-green)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
        >
          Build Options
        </button>
      </div>
    </div>
  );
}
