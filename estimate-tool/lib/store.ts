import { Estimate, EstimateOption } from '@/types/estimate';

// ── Supabase-backed store ─────────────────────────────────────────
// All estimates persist in Supabase via API routes.
// localStorage used only as a read cache for instant UI.

const CACHE_KEY = 'christmas-air-estimates-cache';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Cache helpers ─────────────────────────────────────────────────

function getCache(): Record<string, Estimate> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function setCache(estimates: Record<string, Estimate>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(estimates)); } catch {}
}

function cacheEstimate(est: Estimate) {
  const cache = getCache();
  cache[est.id] = est;
  setCache(cache);
}

function removeCached(id: string) {
  const cache = getCache();
  delete cache[id];
  setCache(cache);
}

// ── Convert between DB shape and app shape ────────────────────────

function dbToEstimate(row: any): Estimate {
  const options: EstimateOption[] = (row.estimate_options || []).map((opt: any) => ({
    id: opt.id,
    label: opt.label,
    packageId: undefined,
    equipment: opt.st_service_id ? [{
      id: `st-svc-${opt.st_service_id}`,
      name: opt.system_name,
      brand: opt.system_brand,
      model: opt.st_service_code || '',
      type: (opt.system_stage === 'Variable' || opt.system_name?.toLowerCase().includes('heat pump')) ? 'heat-pump' as const : 'air-conditioner' as const,
      description: opt.system_description || '',
      features: [],
      seer: opt.system_seer || 0,
      retailPrice: Number(opt.system_price) || 0,
      tier: 'good' as const,
      stSkuId: opt.st_service_id,
      stCode: opt.st_service_code,
    }] : [],
    addOns: opt.add_ons || [],
    installItems: opt.install_items || [],
    warranties: [],
    discounts: [],
    laborCost: Number(opt.labor_cost) || 0,
    notes: '',
    _color: opt.color,
    _hidden: opt.hidden,
    _sortOrder: opt.sort_order,
    _equipmentRefs: opt.equipment_refs,
  }));

  // Sort by sort_order
  options.sort((a: any, b: any) => (a._sortOrder || 0) - (b._sortOrder || 0));

  return {
    id: row.id,
    customerName: row.customer_name || '',
    customerAddress: row.customer_address || '',
    customerPhone: row.customer_phone || '',
    customerEmail: row.customer_email || '',
    advisorName: row.advisor_name || '',
    systemType: row.system_type || 'ac-furnace',
    existingSystem: row.existing_system || '',
    notes: row.notes || '',
    options,
    selectedOptionId: row.selected_option_id || undefined,
    status: row.status || 'draft',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    stJobId: row.st_job_id,
    stJobNumber: row.st_job_number,
    stCustomerId: row.st_customer_id,
    stLocationId: row.st_location_id,
    stEstimateId: row.st_estimate_id,
    selectedReviews: row.selected_reviews || [],
  };
}

function estimateToDb(est: Estimate) {
  return {
    customer_name: est.customerName,
    customer_address: est.customerAddress,
    customer_phone: est.customerPhone,
    customer_email: est.customerEmail,
    advisor_name: est.advisorName,
    system_type: est.systemType,
    notes: est.notes,
    existing_system: est.existingSystem,
    status: est.status,
    selected_option_id: est.selectedOptionId || null,
    st_job_id: est.stJobId || null,
    st_job_number: est.stJobNumber || null,
    st_customer_id: est.stCustomerId || null,
    st_location_id: est.stLocationId || null,
    st_estimate_id: est.stEstimateId || null,
    selected_reviews: est.selectedReviews || [],
  };
}

function optionToDb(opt: EstimateOption, idx: number) {
  const eq = opt.equipment[0];
  return {
    id: opt.id,
    label: opt.label,
    sort_order: idx,
    color: (opt as any)._color || null,
    hidden: (opt as any)._hidden || false,
    stServiceId: eq?.stSkuId || null,
    stServiceCode: eq?.stCode || eq?.model || null,
    systemName: eq?.name || '',
    systemBrand: eq?.brand || 'American Standard',
    systemSeer: eq?.seer || null,
    systemStage: eq?.description?.includes('Variable') ? 'Variable' :
                  eq?.description?.includes('Two-Stage') || eq?.description?.includes('2-Stage') ? 'Two-Stage' : 'Single-Stage',
    systemDescription: eq?.description || null,
    systemPrice: eq?.retailPrice || 0,
    laborCost: opt.laborCost || 0,
    addOns: opt.addOns || [],
    installItems: opt.installItems || [],
    equipmentRefs: (opt as any)._equipmentRefs || [],
  };
}

// ── Public API ────────────────────────────────────────────────────

export async function fetchAllEstimates(): Promise<Estimate[]> {
  try {
    const res = await fetch('/api/estimates');
    if (!res.ok) throw new Error('Failed to fetch');
    const { estimates } = await res.json();
    const mapped = estimates.map(dbToEstimate);
    // Update cache
    const cache: Record<string, Estimate> = {};
    for (const est of mapped) cache[est.id] = est;
    setCache(cache);
    return mapped;
  } catch {
    // Fallback to cache
    return Object.values(getCache());
  }
}

export async function fetchEstimate(id: string): Promise<Estimate | null> {
  try {
    const res = await fetch(`/api/estimates/${id}`);
    if (!res.ok) return getCachedEstimate(id);
    const { estimate } = await res.json();
    const mapped = dbToEstimate(estimate);
    cacheEstimate(mapped);
    return mapped;
  } catch {
    return getCachedEstimate(id);
  }
}

export async function createEstimate(data: Partial<Estimate> = {}): Promise<Estimate> {
  const res = await fetch('/api/estimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: data.customerName || '',
      customerAddress: data.customerAddress || '',
      customerPhone: data.customerPhone || '',
      customerEmail: data.customerEmail || '',
      advisorName: data.advisorName || '',
      systemType: data.systemType || 'ac-furnace',
      stJobId: data.stJobId,
      stJobNumber: data.stJobNumber,
      stCustomerId: data.stCustomerId,
      stLocationId: data.stLocationId,
      notes: data.notes || '',
      existingSystem: data.existingSystem || '',
    }),
  });
  if (!res.ok) throw new Error('Failed to create estimate');
  const { estimate } = await res.json();
  const mapped = dbToEstimate(estimate);
  cacheEstimate(mapped);
  return mapped;
}

export async function updateEstimate(est: Estimate): Promise<Estimate> {
  // Optimistic cache update
  cacheEstimate(est);

  const res = await fetch(`/api/estimates/${est.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...estimateToDb(est),
      options: est.options.map((opt, idx) => optionToDb(opt, idx)),
    }),
  });

  if (!res.ok) {
    console.error('[Store] Failed to save estimate to Supabase');
    return est; // Return cached version
  }

  const { estimate } = await res.json();
  const mapped = dbToEstimate(estimate);
  cacheEstimate(mapped);
  return mapped;
}

export async function deleteEstimate(id: string): Promise<void> {
  removeCached(id);
  await fetch(`/api/estimates/${id}`, { method: 'DELETE' }).catch(() => {});
}

// ── Sync helpers (used by components) ─────────────────────────────

// Get from cache instantly (for initial render before async fetch)
export function getCachedEstimate(id: string): Estimate | null {
  return getCache()[id] || null;
}

export function getCachedEstimates(): Estimate[] {
  return Object.values(getCache()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ── Legacy compatibility ──────────────────────────────────────────
// These sync wrappers let existing components work while we migrate them to async

export function getAllEstimates(): Estimate[] {
  return getCachedEstimates();
}

export function getEstimate(id: string): Estimate | undefined {
  return getCachedEstimate(id) || undefined;
}

export function saveEstimate(est: Estimate): Estimate {
  cacheEstimate(est);
  // Fire and forget the async save
  updateEstimate(est).catch(err => console.error('[Store] Background save failed:', err));
  return est;
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
      createBlankOption('Builder'),
      createBlankOption('Silver'),
      createBlankOption('Gold'),
      createBlankOption('Platinum'),
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

export function createOptionFromPackage(pkg: any): EstimateOption {
  return {
    id: generateId(),
    label: pkg.tier?.charAt(0).toUpperCase() + pkg.tier?.slice(1) || 'Option',
    packageId: pkg.id,
    equipment: [...(pkg.equipment || [])],
    addOns: [...(pkg.addOns || [])],
    installItems: (pkg.installItems || []).map((item: any) => ({ ...item })),
    warranties: [...(pkg.warranties || [])],
    discounts: [],
    laborCost: pkg.laborCost || 0,
    notes: '',
  };
}
