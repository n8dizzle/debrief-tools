'use client';

import { Estimate } from '@/types/estimate';

interface CustomerInfoProps {
  estimate: Estimate;
  onChange: (updates: Partial<Estimate>) => void;
  onContinue: () => void;
}

export default function CustomerInfo({ estimate, onChange, onContinue }: CustomerInfoProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
          <input
            type="text"
            value={estimate.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
            placeholder="John & Jane Smith"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            value={estimate.customerAddress}
            onChange={(e) => onChange({ customerAddress: e.target.value })}
            placeholder="123 Main St, Denton, TX 76201"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={estimate.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
            placeholder="(940) 555-1234"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={estimate.customerEmail}
            onChange={(e) => onChange({ customerEmail: e.target.value })}
            placeholder="john@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comfort Advisor</label>
          <input
            type="text"
            value={estimate.advisorName}
            onChange={(e) => onChange({ advisorName: e.target.value })}
            placeholder="Advisor name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System Type</label>
          <select
            value={estimate.systemType}
            onChange={(e) => onChange({ systemType: e.target.value as Estimate['systemType'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          >
            <option value="replacement">Replacement</option>
            <option value="new-install">New Installation</option>
            <option value="add-on">Add-On / Upgrade</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Existing System</label>
          <input
            type="text"
            value={estimate.existingSystem || ''}
            onChange={(e) => onChange({ existingSystem: e.target.value })}
            placeholder="e.g., 15-year-old 10 SEER Trane AC + 80% furnace"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={estimate.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Any notes about the job, customer concerns, etc."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onContinue}
          className="px-6 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
        >
          Continue to Options &rarr;
        </button>
      </div>
    </div>
  );
}
