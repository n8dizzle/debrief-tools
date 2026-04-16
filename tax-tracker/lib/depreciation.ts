import { BPPDepreciationSchedule } from './supabase';

/**
 * Calculate depreciated value for an asset given its original cost,
 * year acquired, and the depreciation schedule for its category.
 */
export function calculateDepreciatedValue(
  originalCost: number,
  yearAcquired: number,
  schedules: BPPDepreciationSchedule[],
  taxYear?: number
): number {
  const year = taxYear || new Date().getFullYear();
  const age = year - yearAcquired;

  if (age < 0) return originalCost;

  // Find the matching schedule entry
  const entry = schedules.find(s => s.age_years === age);
  if (entry) {
    return Math.round(originalCost * (entry.depreciation_percent / 100) * 100) / 100;
  }

  // If age exceeds schedule, use the last (lowest) entry
  const sorted = [...schedules].sort((a, b) => b.age_years - a.age_years);
  if (sorted.length > 0 && age > sorted[0].age_years) {
    return Math.round(originalCost * (sorted[0].depreciation_percent / 100) * 100) / 100;
  }

  // Fallback: return original cost
  return originalCost;
}

/**
 * Get the depreciation percentage for a given age from a schedule
 */
export function getDepreciationPercent(
  schedules: BPPDepreciationSchedule[],
  age: number
): number {
  const entry = schedules.find(s => s.age_years === age);
  if (entry) return entry.depreciation_percent;

  const sorted = [...schedules].sort((a, b) => b.age_years - a.age_years);
  if (sorted.length > 0 && age > sorted[0].age_years) {
    return sorted[0].depreciation_percent;
  }

  return 100;
}
