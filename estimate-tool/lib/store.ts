import { Estimate, EstimateOption, Package } from '@/types/estimate';

const STORAGE_KEY = 'christmas-air-estimates';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getAllEstimates(): Estimate[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getEstimate(id: string): Estimate | undefined {
  return getAllEstimates().find(e => e.id === id);
}

export function saveEstimate(estimate: Estimate): Estimate {
  const all = getAllEstimates();
  const idx = all.findIndex(e => e.id === estimate.id);
  estimate.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = estimate;
  } else {
    all.push(estimate);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return estimate;
}

export function deleteEstimate(id: string): void {
  const all = getAllEstimates().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function createBlankEstimate(advisorName: string = ''): Estimate {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    customerName: '',
    customerAddress: '',
    customerPhone: '',
    customerEmail: '',
    advisorName,
    systemType: 'replacement',
    notes: '',
    options: [
      createBlankOption('Good'),
      createBlankOption('Better'),
      createBlankOption('Best'),
    ],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankOption(label: string): EstimateOption {
  return {
    id: generateId(),
    label,
    equipment: [],
    addOns: [],
    installItems: [],
    warranties: [],
    discounts: [],
    laborCost: 0,
    notes: '',
  };
}

export function createOptionFromPackage(pkg: Package): EstimateOption {
  return {
    id: generateId(),
    label: pkg.tier.charAt(0).toUpperCase() + pkg.tier.slice(1),
    packageId: pkg.id,
    equipment: [...pkg.equipment],
    addOns: [...pkg.addOns],
    installItems: pkg.installItems.map(item => ({ ...item })),
    warranties: [...pkg.warranties],
    discounts: [],
    laborCost: pkg.laborCost,
    notes: '',
  };
}
