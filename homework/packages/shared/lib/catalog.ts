// @homework/shared catalog
// Catalog utility functions for service pricing, HomeFit evaluation, and search.

import type {
  Service,
  ServiceVariable,
  ServiceVariableOption,
  ServiceAddon,
  HomeFitRule,
  HomeFitResult,
  HomeFeature,
  ProductizabilityType,
} from './types';

// ---------------------------------------------------------------------------
// Productizability helpers
// ---------------------------------------------------------------------------

/** Services that can show a price immediately (no quote needed) */
export const INSTANT_PRICE_TYPES: ProductizabilityType[] = ['instant_price', 'configurator'];

/** Services that require some form of estimate */
export const ESTIMATE_REQUIRED_TYPES: ProductizabilityType[] = [
  'photo_estimate',
  'onsite_estimate',
  'custom',
];

/** Human-readable labels for productizability types */
export const PRODUCTIZABILITY_LABELS: Record<ProductizabilityType, string> = {
  instant_price: 'Instant Price',
  configurator: 'Configure & Price',
  photo_estimate: 'Photo Estimate',
  onsite_estimate: 'Onsite Estimate',
  custom: 'Custom Quote',
};

/** Whether a service can be added to cart directly */
export function isBookableOnline(service: Service): boolean {
  return INSTANT_PRICE_TYPES.includes(service.productizability);
}

/** Whether a service requires an estimate before purchase */
export function requiresEstimate(service: Service): boolean {
  return ESTIMATE_REQUIRED_TYPES.includes(service.productizability);
}

// ---------------------------------------------------------------------------
// Price Calculation
// ---------------------------------------------------------------------------

export interface PriceBreakdown {
  base_price_cents: number;
  variable_adjustments_cents: number;
  addons_cents: number;
  total_cents: number;
  details: {
    variable_adjustments: Array<{ name: string; amount_cents: number }>;
    addons: Array<{ name: string; amount_cents: number }>;
  };
}

/**
 * Calculate the total price for a service given selected variables and addons.
 * All amounts are in cents.
 *
 * Formula: total = base_price + sum(variable_adjustments) + sum(addon_prices)
 */
export function calculateServicePrice(
  service: Service,
  selectedVariables: Record<string, string | number | boolean>,
  selectedAddonIds: string[],
  contractorBasePriceCents?: number // Optional override from contractor pricing
): PriceBreakdown {
  const basePriceCents = contractorBasePriceCents ?? service.base_price_cents ?? 0;

  // Calculate variable adjustments
  const variableAdjustments: Array<{ name: string; amount_cents: number }> = [];
  let totalVariableAdjustment = 0;

  if (service.variables) {
    for (const variable of service.variables) {
      const selectedValue = selectedVariables[variable.slug];
      if (selectedValue === undefined) continue;

      const adjustment = getVariableAdjustment(variable, selectedValue);
      if (adjustment !== 0) {
        variableAdjustments.push({ name: variable.name, amount_cents: adjustment });
        totalVariableAdjustment += adjustment;
      }
    }
  }

  // Calculate addon totals
  const addonDetails: Array<{ name: string; amount_cents: number }> = [];
  let totalAddons = 0;

  if (service.addons) {
    for (const addon of service.addons) {
      if (selectedAddonIds.includes(addon.id) && addon.is_active) {
        addonDetails.push({ name: addon.name, amount_cents: addon.price_cents });
        totalAddons += addon.price_cents;
      }
    }
  }

  return {
    base_price_cents: basePriceCents,
    variable_adjustments_cents: totalVariableAdjustment,
    addons_cents: totalAddons,
    total_cents: basePriceCents + totalVariableAdjustment + totalAddons,
    details: {
      variable_adjustments: variableAdjustments,
      addons: addonDetails,
    },
  };
}

/**
 * Get the price adjustment for a single variable selection.
 */
function getVariableAdjustment(
  variable: ServiceVariable,
  selectedValue: string | number | boolean
): number {
  if (variable.variable_type === 'select' && variable.options) {
    const option = variable.options.find(
      (opt: ServiceVariableOption) => opt.value === String(selectedValue)
    );
    return option?.price_adjustment_cents ?? 0;
  }

  // For boolean and number types, adjustments would typically be handled
  // via pricing rules on the backend. Return 0 for client-side calculation.
  return 0;
}

/**
 * Format a price breakdown into a display-friendly summary.
 */
export function formatPriceBreakdown(breakdown: PriceBreakdown): string {
  const parts: string[] = [];
  parts.push(`Base: $${(breakdown.base_price_cents / 100).toFixed(2)}`);

  for (const adj of breakdown.details.variable_adjustments) {
    const sign = adj.amount_cents >= 0 ? '+' : '';
    parts.push(`${adj.name}: ${sign}$${(adj.amount_cents / 100).toFixed(2)}`);
  }

  for (const addon of breakdown.details.addons) {
    parts.push(`${addon.name}: +$${(addon.amount_cents / 100).toFixed(2)}`);
  }

  parts.push(`Total: $${(breakdown.total_cents / 100).toFixed(2)}`);
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// HomeFit Evaluation
// ---------------------------------------------------------------------------

export interface HomeFitEvaluation {
  result: HomeFitResult;
  passed_rules: HomeFitRule[];
  failed_rules: HomeFitRule[];
  messages: string[];                    // Failure messages to show the homeowner
}

/**
 * Evaluate whether a service is compatible with a home based on HomeFit rules.
 *
 * - All rules pass -> 'compatible'
 * - Any blocking rule fails -> 'incompatible'
 * - Non-blocking rule fails -> 'needs_review'
 */
export function evaluateHomeFit(
  rules: HomeFitRule[],
  homeFeatures: HomeFeature[]
): HomeFitEvaluation {
  const featureMap = new Map<string, string>();
  for (const feature of homeFeatures) {
    featureMap.set(feature.feature_key, feature.feature_value);
  }

  const passed: HomeFitRule[] = [];
  const failed: HomeFitRule[] = [];
  const messages: string[] = [];

  for (const rule of rules) {
    const featureValue = featureMap.get(rule.home_feature_key);

    // If the home doesn't have this feature, treat as needs_review (not blocking)
    if (featureValue === undefined) {
      failed.push(rule);
      if (!rule.is_blocking) {
        messages.push(rule.fail_message);
      }
      continue;
    }

    const ruleResult = evaluateRule(rule, featureValue);

    if (ruleResult) {
      passed.push(rule);
    } else {
      failed.push(rule);
      messages.push(rule.fail_message);
    }
  }

  let result: HomeFitResult = 'compatible';

  if (failed.length > 0) {
    const hasBlockingFailure = failed.some((r) => r.is_blocking);
    result = hasBlockingFailure ? 'incompatible' : 'needs_review';
  }

  return { result, passed_rules: passed, failed_rules: failed, messages };
}

/**
 * Evaluate a single HomeFit rule against a home feature value.
 */
function evaluateRule(rule: HomeFitRule, featureValue: string): boolean {
  const ruleValue = rule.value;

  switch (rule.operator) {
    case 'eq':
      return featureValue === ruleValue;

    case 'neq':
      return featureValue !== ruleValue;

    case 'gt':
      return Number(featureValue) > Number(ruleValue);

    case 'gte':
      return Number(featureValue) >= Number(ruleValue);

    case 'lt':
      return Number(featureValue) < Number(ruleValue);

    case 'lte':
      return Number(featureValue) <= Number(ruleValue);

    case 'in': {
      const allowedValues: string[] = JSON.parse(ruleValue);
      return allowedValues.includes(featureValue);
    }

    case 'not_in': {
      const disallowedValues: string[] = JSON.parse(ruleValue);
      return !disallowedValues.includes(featureValue);
    }

    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Search / Filter Helpers
// ---------------------------------------------------------------------------

/**
 * Filter services by search query (matches name, short_description).
 * For client-side filtering of already-fetched services.
 */
export function filterServicesByQuery(services: Service[], query: string): Service[] {
  if (!query.trim()) return services;

  const terms = query.toLowerCase().split(/\s+/);

  return services.filter((service) => {
    const searchable = `${service.name} ${service.short_description}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Sort services by the given sort key.
 */
export function sortServices(
  services: Service[],
  sortBy: 'price_asc' | 'price_desc' | 'popular' | 'newest' | 'name'
): Service[] {
  const sorted = [...services];

  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => (a.base_price_cents ?? 0) - (b.base_price_cents ?? 0));
    case 'price_desc':
      return sorted.sort((a, b) => (b.base_price_cents ?? 0) - (a.base_price_cents ?? 0));
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'popular':
    default:
      // Featured first, then by display_order
      return sorted.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return a.display_order - b.display_order;
      });
  }
}

/**
 * Get the price display text for a service.
 * - instant_price / configurator: show the price
 * - estimate types: show "Free Estimate" or "Get Quote"
 */
export function getServicePriceDisplay(service: Service): string {
  if (service.productizability === 'instant_price' && service.base_price_cents != null) {
    return `$${(service.base_price_cents / 100).toFixed(2)}`;
  }

  if (service.productizability === 'configurator' && service.base_price_cents != null) {
    return `From $${(service.base_price_cents / 100).toFixed(2)}`;
  }

  if (service.productizability === 'photo_estimate') {
    return 'Free Photo Estimate';
  }

  if (service.productizability === 'onsite_estimate') {
    return 'Free Onsite Estimate';
  }

  return 'Get Quote';
}
