// Pricing engine: generates initial price book from market rates + contractor cost structure.
// Hybrid approach: market rate baseline adjusted for contractor's margin preference,
// cross-checked with cost-plus calculation.

interface MarketRate {
  service_id: string;
  low_price: number;   // cents
  median_price: number; // cents
  high_price: number;   // cents
  labor_pct: number;
  materials_pct: number;
}

interface CostStructure {
  labor_cost_pct: number;
  materials_cost_pct: number;
  overhead_pct: number;
  profit_margin_pct: number;
}

interface ServiceVariable {
  id: string;
  service_id: string;
  options: { value: string; label: string; price_modifier: number }[] | null;
  affects_pricing: boolean;
}

interface ServiceAddon {
  id: string;
  service_id: string;
  suggested_price: number; // cents
}

interface GeneratedPrice {
  service_id: string;
  base_price: number; // cents
  variable_pricing: Record<string, Record<string, number>>;
  addon_pricing: Record<string, number>;
}

const INDUSTRY_AVG_PROFIT_PCT = 15;

// Generate a price for a single service
export function calculateServicePrice(
  rate: MarketRate,
  costStructure: CostStructure
): number {
  // 1. Start with median market rate
  let price = rate.median_price;

  // 2. Adjust for contractor's profit margin preference vs industry norm
  const marginDelta = costStructure.profit_margin_pct - INDUSTRY_AVG_PROFIT_PCT;
  if (marginDelta !== 0) {
    // Scale price proportionally to margin difference
    const adjustmentFactor = 1 + (marginDelta / 100);
    price = Math.round(price * adjustmentFactor);
  }

  // 3. Cross-check with cost-plus calculation
  // cost_plus_price = estimated_cost / (1 - profit_margin)
  const totalCostPct = costStructure.labor_cost_pct + costStructure.materials_cost_pct + costStructure.overhead_pct;
  if (totalCostPct > 0 && totalCostPct < 100) {
    // Estimate cost using service-specific labor/materials split + contractor's overhead
    const serviceCostPct = (rate.labor_pct || 40) + (rate.materials_pct || 25);
    // Scale to contractor's actual cost ratios
    const contractorCostRatio = totalCostPct / serviceCostPct;
    const costPlusPrice = Math.round(rate.median_price * contractorCostRatio);

    // If cost-plus diverges >20% from market-adjusted price, use weighted average
    const divergence = Math.abs(costPlusPrice - price) / price;
    if (divergence > 0.20) {
      // 70% market, 30% cost-plus
      price = Math.round(price * 0.7 + costPlusPrice * 0.3);
    }
  }

  // 4. Clamp within market range
  price = Math.max(rate.low_price, Math.min(rate.high_price, price));

  // 5. Round to nearest $5 (500 cents)
  price = Math.round(price / 500) * 500;

  // Minimum $5
  return Math.max(500, price);
}

// Generate variable pricing from catalog variable options
export function generateVariablePricing(
  variables: ServiceVariable[],
  basePrice: number
): Record<string, Record<string, number>> {
  const variablePricing: Record<string, Record<string, number>> = {};

  for (const variable of variables) {
    if (!variable.affects_pricing || !variable.options) continue;

    const optionPricing: Record<string, number> = {};
    for (const option of variable.options) {
      // price_modifier is already in cents from the catalog
      optionPricing[option.value] = option.price_modifier || 0;
    }

    if (Object.keys(optionPricing).length > 0) {
      variablePricing[variable.id] = optionPricing;
    }
  }

  return variablePricing;
}

// Generate addon pricing from catalog addon suggested prices
export function generateAddonPricing(
  addons: ServiceAddon[]
): Record<string, number> {
  const addonPricing: Record<string, number> = {};
  for (const addon of addons) {
    addonPricing[addon.id] = addon.suggested_price || 0;
  }
  return addonPricing;
}

// Generate full price book for a set of services
export function generatePriceBook(
  marketRates: MarketRate[],
  costStructure: CostStructure,
  variablesByService: Record<string, ServiceVariable[]>,
  addonsByService: Record<string, ServiceAddon[]>
): GeneratedPrice[] {
  return marketRates.map((rate) => {
    const basePrice = calculateServicePrice(rate, costStructure);
    const variables = variablesByService[rate.service_id] || [];
    const addons = addonsByService[rate.service_id] || [];

    return {
      service_id: rate.service_id,
      base_price: basePrice,
      variable_pricing: generateVariablePricing(variables, basePrice),
      addon_pricing: generateAddonPricing(addons),
    };
  });
}
