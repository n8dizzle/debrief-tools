export interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  type: EquipmentType;
  description: string;
  features: string[];
  seer?: number;
  afue?: number;
  tons?: number;
  btu?: number;
  imageUrl?: string;
  retailPrice: number;
  tier: 'good' | 'better' | 'best';
  stSkuId?: number;  // ServiceTitan pricebook equipment ID
  stCode?: string;   // ServiceTitan pricebook code/SKU
}

export type EquipmentType =
  | 'air-conditioner'
  | 'heat-pump'
  | 'furnace'
  | 'air-handler'
  | 'mini-split'
  | 'package-unit';

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'indoor-air-quality' | 'comfort' | 'protection' | 'smart-home' | string;
  imageUrl?: string;
  popular?: boolean;
  stSkuId?: number;
  stCode?: string;
  stType?: 'Service' | 'Material' | 'Equipment';
}

export interface InstallItem {
  id: string;
  name: string;
  description?: string;
  category: 'materials' | 'electrical' | 'ductwork' | 'refrigerant' | 'misc' | string;
  unitCost: number;
  quantity: number;
  stSkuId?: number;
  stCode?: string;
}

export interface Warranty {
  id: string;
  name: string;
  description: string;
  coverage: string;
  term: string;          // e.g. "10 Years", "Lifetime"
  price: number;
  imageUrl?: string;
  stSkuId?: number;
  stCode?: string;
  stType?: 'Service' | 'Material' | 'Equipment';
}

export interface Discount {
  id: string;
  name: string;
  type: 'flat' | 'percent';
  amount: number;        // flat $ amount or percentage
}

// Pre-built package that bundles equipment + add-ons + install items + warranty
export interface Package {
  id: string;
  name: string;
  description: string;
  tier: 'good' | 'better' | 'best';
  imageUrl?: string;
  equipment: Equipment[];
  addOns: AddOn[];
  installItems: InstallItem[];
  warranties: Warranty[];
  laborCost: number;
}

export interface EstimateOption {
  id: string;
  label: string;
  packageId?: string;           // if created from a package
  equipment: Equipment[];
  addOns: AddOn[];
  installItems: InstallItem[];
  warranties: Warranty[];
  discounts: Discount[];
  laborCost: number;
  notes: string;
}

export interface Estimate {
  id: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  advisorName: string;
  systemType: 'replacement' | 'new-install' | 'add-on';
  existingSystem?: string;
  notes: string;
  options: EstimateOption[];
  selectedOptionId?: string;
  status: 'draft' | 'presented' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
  // ServiceTitan integration
  stJobId?: number;
  stJobNumber?: string;
  stCustomerId?: number;
  stLocationId?: number;
  stEstimateId?: number; // set after pushing to ST
}

export interface FinancingTerm {
  id: string;
  name: string;
  months: number;
  apr: number;
  minAmount: number;
}

export function getInstallItemsTotal(items: InstallItem[]): number {
  return items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
}

export function getWarrantiesTotal(warranties: Warranty[]): number {
  return warranties.reduce((sum, w) => sum + w.price, 0);
}

export function getDiscountsTotal(discounts: Discount[], subtotal: number): number {
  return discounts.reduce((sum, d) => {
    if (d.type === 'flat') return sum + d.amount;
    return sum + (subtotal * d.amount / 100);
  }, 0);
}

export function getOptionTotal(option: EstimateOption): number {
  const equipmentTotal = option.equipment.reduce((sum, eq) => sum + eq.retailPrice, 0);
  const addOnTotal = option.addOns.reduce((sum, ao) => sum + ao.price, 0);
  const installTotal = getInstallItemsTotal(option.installItems || []);
  const warrantyTotal = getWarrantiesTotal(option.warranties || []);
  const subtotal = equipmentTotal + addOnTotal + installTotal + warrantyTotal + option.laborCost;
  const discountTotal = getDiscountsTotal(option.discounts || [], subtotal);
  return subtotal - discountTotal;
}

export function getMonthlyPayment(total: number, term: FinancingTerm): number {
  if (term.apr === 0) return total / term.months;
  const monthlyRate = term.apr / 100 / 12;
  return (total * monthlyRate * Math.pow(1 + monthlyRate, term.months)) /
    (Math.pow(1 + monthlyRate, term.months) - 1);
}
