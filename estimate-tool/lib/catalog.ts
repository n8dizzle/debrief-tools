import { Equipment, AddOn, InstallItem, Warranty, Discount, Package, FinancingTerm } from '@/types/estimate';

// ── Equipment Catalog ───────────────────────────────────────────────

export const equipmentCatalog: Equipment[] = [
  // ── Good Tier ──────────────────────────────────────────────────
  {
    id: 'ac-good',
    name: '14 SEER2 Air Conditioner',
    brand: 'Goodman',
    model: 'GSXN4',
    type: 'air-conditioner',
    description: 'Reliable, budget-friendly cooling. Meets minimum federal efficiency standards.',
    features: ['14 SEER2 Efficiency', 'Single-Stage Compressor', 'R-410A Refrigerant', '10-Year Parts Warranty'],
    seer: 14,
    tons: 3,
    imageUrl: '/images/equipment/ac-good.jpg',
    retailPrice: 4200,
    tier: 'good',
  },
  {
    id: 'furnace-good',
    name: '80% AFUE Gas Furnace',
    brand: 'Goodman',
    model: 'GMVC80',
    type: 'furnace',
    description: 'Dependable heating at an affordable price point.',
    features: ['80% AFUE', 'Multi-Speed Blower', 'Tubular Heat Exchanger', '10-Year Parts Warranty'],
    afue: 80,
    btu: 80000,
    imageUrl: '/images/equipment/furnace-good.jpg',
    retailPrice: 3200,
    tier: 'good',
  },

  // ── Better Tier ────────────────────────────────────────────────
  {
    id: 'ac-better',
    name: '16 SEER2 Air Conditioner',
    brand: 'Goodman',
    model: 'GSXC16',
    type: 'air-conditioner',
    description: 'Enhanced efficiency with two-stage cooling for better comfort and lower bills.',
    features: ['16 SEER2 Efficiency', 'Two-Stage Compressor', 'Quieter Operation', 'ComfortBridge Technology', '10-Year Parts Warranty'],
    seer: 16,
    tons: 3,
    imageUrl: '/images/equipment/ac-better.jpg',
    retailPrice: 5800,
    tier: 'better',
  },
  {
    id: 'furnace-better',
    name: '96% AFUE Gas Furnace',
    brand: 'Goodman',
    model: 'GMVC96',
    type: 'furnace',
    description: 'High-efficiency heating with variable-speed blower for even temperatures.',
    features: ['96% AFUE', 'Variable-Speed ECM Blower', 'Two-Stage Gas Valve', 'Stainless Steel Heat Exchanger', '10-Year Parts Warranty'],
    afue: 96,
    btu: 80000,
    imageUrl: '/images/equipment/furnace-better.jpg',
    retailPrice: 4600,
    tier: 'better',
  },

  // ── Best Tier ──────────────────────────────────────────────────
  {
    id: 'ac-best',
    name: '20 SEER2 Air Conditioner',
    brand: 'Goodman',
    model: 'GSXV9',
    type: 'air-conditioner',
    description: 'Premium inverter-driven cooling. Maximum efficiency, whisper-quiet operation.',
    features: ['Up to 20 SEER2', 'Inverter Compressor', 'Variable-Speed', 'Ultra-Quiet (56 dB)', 'ComfortBridge Technology', 'Lifetime Compressor Warranty'],
    seer: 20,
    tons: 3,
    imageUrl: '/images/equipment/ac-best.jpg',
    retailPrice: 7800,
    tier: 'best',
  },
  {
    id: 'furnace-best',
    name: '98% AFUE Gas Furnace',
    brand: 'Goodman',
    model: 'GMVM97',
    type: 'furnace',
    description: 'Top-of-the-line modulating furnace. Precise temperature control and maximum savings.',
    features: ['98% AFUE', 'Modulating Gas Valve', 'Variable-Speed ECM Blower', 'ComfortBridge Technology', 'Lifetime Heat Exchanger Warranty'],
    afue: 98,
    btu: 80000,
    imageUrl: '/images/equipment/furnace-best.jpg',
    retailPrice: 5800,
    tier: 'best',
  },

  // ── Heat Pumps ─────────────────────────────────────────────────
  {
    id: 'hp-good',
    name: '14 SEER2 Heat Pump',
    brand: 'Goodman',
    model: 'GSZH5',
    type: 'heat-pump',
    description: 'Efficient year-round comfort. Heats and cools with one system.',
    features: ['14 SEER2 / 7.5 HSPF2', 'Single-Stage', 'R-410A Refrigerant', '10-Year Parts Warranty'],
    seer: 14,
    tons: 3,
    imageUrl: '/images/equipment/hp-good.jpg',
    retailPrice: 4800,
    tier: 'good',
  },
  {
    id: 'hp-better',
    name: '16 SEER2 Heat Pump',
    brand: 'Goodman',
    model: 'GSZV6',
    type: 'heat-pump',
    description: 'Two-stage heat pump for balanced efficiency and comfort.',
    features: ['16 SEER2 / 9.0 HSPF2', 'Two-Stage Compressor', 'Quieter Operation', '10-Year Parts Warranty'],
    seer: 16,
    tons: 3,
    imageUrl: '/images/equipment/hp-better.jpg',
    retailPrice: 6200,
    tier: 'better',
  },
  {
    id: 'hp-best',
    name: '20 SEER2 Heat Pump',
    brand: 'Goodman',
    model: 'GSZV9',
    type: 'heat-pump',
    description: 'Premium inverter heat pump. Maximum efficiency in all seasons.',
    features: ['Up to 20 SEER2 / 10 HSPF2', 'Inverter Compressor', 'Variable-Speed', 'Ultra-Quiet', 'Lifetime Compressor Warranty'],
    seer: 20,
    tons: 3,
    imageUrl: '/images/equipment/hp-best.jpg',
    retailPrice: 8400,
    tier: 'best',
  },
];

// ── Add-Ons ─────────────────────────────────────────────────────────

export const addOnsCatalog: AddOn[] = [
  {
    id: 'uv-light',
    name: 'UV Air Purification System',
    description: 'Kills mold, bacteria, and viruses in your ductwork with germicidal UV-C light.',
    price: 895,
    category: 'indoor-air-quality',
    imageUrl: '/images/addons/uv-light.jpg',
    popular: true,
  },
  {
    id: 'air-scrubber',
    name: 'Air Scrubber Plus',
    description: 'Advanced air purification that removes up to 99.9% of surface and airborne contaminants.',
    price: 1495,
    category: 'indoor-air-quality',
    imageUrl: '/images/addons/air-scrubber.jpg',
    popular: true,
  },
  {
    id: 'media-filter',
    name: '5" Media Filter Cabinet',
    description: 'High-capacity MERV-11 filtration. Lasts 6-12 months between changes.',
    price: 495,
    category: 'indoor-air-quality',
    imageUrl: '/images/addons/media-filter.jpg',
  },
  {
    id: 'whole-home-dehumidifier',
    name: 'Whole-Home Dehumidifier',
    description: 'Controls humidity levels throughout your home for better comfort and air quality.',
    price: 2200,
    category: 'indoor-air-quality',
    imageUrl: '/images/addons/dehumidifier.jpg',
  },
  {
    id: 'smart-thermostat',
    name: 'Ecobee Smart Thermostat',
    description: 'Wi-Fi thermostat with room sensors, voice control, and energy reports.',
    price: 450,
    category: 'comfort',
    imageUrl: '/images/addons/ecobee.jpg',
    popular: true,
  },
  {
    id: 'zoning-system',
    name: '2-Zone Damper System',
    description: 'Control temperatures independently upstairs and downstairs.',
    price: 2800,
    category: 'comfort',
    imageUrl: '/images/addons/zoning.jpg',
  },
  {
    id: 'duct-sealing',
    name: 'Aeroseal Duct Sealing',
    description: 'Seal duct leaks from the inside. Improves efficiency by up to 30%.',
    price: 2500,
    category: 'comfort',
    imageUrl: '/images/addons/aeroseal.jpg',
  },
  {
    id: 'surge-protector',
    name: 'HVAC Surge Protector',
    description: 'Protects your new system from power surges and electrical spikes.',
    price: 295,
    category: 'protection',
    imageUrl: '/images/addons/surge-protector.jpg',
    popular: true,
  },
  {
    id: 'maintenance-plan',
    name: '2-Year Maintenance Plan',
    description: 'Includes 4 seasonal tune-ups to keep your new system running at peak performance.',
    price: 598,
    category: 'protection',
    imageUrl: '/images/addons/maintenance.jpg',
  },
  {
    id: 'smart-vent',
    name: 'Smart Vent System (4 vents)',
    description: 'Automated register vents that redirect airflow room by room.',
    price: 1200,
    category: 'smart-home',
    imageUrl: '/images/addons/smart-vent.jpg',
  },
];

// ── Install Items (materials & supplies) ────────────────────────────

export const installItemsCatalog: InstallItem[] = [
  // Materials
  { id: 'lineset-3/8-3/4', name: '3/8" x 3/4" Copper Line Set (30ft)', category: 'materials', unitCost: 185, quantity: 1 },
  { id: 'lineset-3/8-7/8', name: '3/8" x 7/8" Copper Line Set (30ft)', category: 'materials', unitCost: 225, quantity: 1 },
  { id: 'condenser-pad', name: 'Condenser Pad (36"x36")', category: 'materials', unitCost: 65, quantity: 1 },
  { id: 'drain-pan', name: 'Secondary Drain Pan', category: 'materials', unitCost: 45, quantity: 1 },
  { id: 'float-switch', name: 'Safety Float Switch', category: 'materials', unitCost: 35, quantity: 1 },
  { id: 'condensate-pump', name: 'Condensate Pump', category: 'materials', unitCost: 95, quantity: 1 },
  { id: 'filter-drier', name: 'Liquid Line Filter Drier', category: 'materials', unitCost: 28, quantity: 1 },
  { id: 'thermostat-wire', name: 'Thermostat Wire (50ft)', category: 'materials', unitCost: 32, quantity: 1 },
  { id: 'pvc-drain', name: 'PVC Condensate Drain Kit', category: 'materials', unitCost: 25, quantity: 1 },

  // Electrical
  { id: 'disconnect', name: 'Non-Fused Disconnect', category: 'electrical', unitCost: 35, quantity: 1 },
  { id: 'whip-6ft', name: '6ft Electrical Whip', category: 'electrical', unitCost: 28, quantity: 1 },
  { id: 'breaker-30a', name: '30A Circuit Breaker', category: 'electrical', unitCost: 18, quantity: 1 },
  { id: 'breaker-60a', name: '60A Circuit Breaker', category: 'electrical', unitCost: 28, quantity: 1 },

  // Ductwork
  { id: 'plenum-supply', name: 'Supply Plenum', category: 'ductwork', unitCost: 145, quantity: 1 },
  { id: 'plenum-return', name: 'Return Plenum', category: 'ductwork', unitCost: 135, quantity: 1 },
  { id: 'flex-duct-8', name: '8" Flex Duct (25ft)', category: 'ductwork', unitCost: 55, quantity: 1 },
  { id: 'flex-duct-10', name: '10" Flex Duct (25ft)', category: 'ductwork', unitCost: 68, quantity: 1 },
  { id: 'duct-board', name: 'Duct Board Sheet (4x10)', category: 'ductwork', unitCost: 42, quantity: 1 },
  { id: 'register', name: 'Supply Register', category: 'ductwork', unitCost: 18, quantity: 1 },
  { id: 'return-grille', name: 'Return Air Grille', category: 'ductwork', unitCost: 25, quantity: 1 },

  // Refrigerant
  { id: 'r410a-lb', name: 'R-410A Refrigerant (per lb)', category: 'refrigerant', unitCost: 35, quantity: 1 },
  { id: 'nitrogen', name: 'Nitrogen Tank Rental', category: 'refrigerant', unitCost: 45, quantity: 1 },

  // Misc
  { id: 'permit', name: 'City Permit', category: 'misc', unitCost: 150, quantity: 1 },
  { id: 'disposal', name: 'Old Equipment Disposal', category: 'misc', unitCost: 125, quantity: 1 },
  { id: 'crane', name: 'Crane / Lift Service', category: 'misc', unitCost: 450, quantity: 1 },
  { id: 'misc-supplies', name: 'Misc Supplies (tape, mastic, screws, etc.)', category: 'misc', unitCost: 75, quantity: 1 },
];

// ── Warranties ──────────────────────────────────────────────────────

export const warrantiesCatalog: Warranty[] = [
  {
    id: 'labor-5yr',
    name: '5-Year Labor Warranty',
    description: 'Covers all labor costs for repairs during the warranty period.',
    coverage: 'All labor on installed equipment',
    term: '5 Years',
    price: 495,
    imageUrl: '/images/warranties/labor-warranty.jpg',
  },
  {
    id: 'labor-10yr',
    name: '10-Year Labor Warranty',
    description: 'Extends labor coverage to match the manufacturer parts warranty. Full peace of mind.',
    coverage: 'All labor on installed equipment',
    term: '10 Years',
    price: 895,
    imageUrl: '/images/warranties/labor-warranty.jpg',
  },
  {
    id: 'extended-parts',
    name: 'Extended Parts Warranty',
    description: 'Extended coverage beyond manufacturer warranty on all major components.',
    coverage: 'Compressor, coil, heat exchanger, and all parts',
    term: '12 Years',
    price: 695,
    imageUrl: '/images/warranties/parts-warranty.jpg',
  },
  {
    id: 'total-comfort',
    name: 'Total Comfort Guarantee',
    description: 'Our premium coverage — if your system can\'t keep up, we\'ll make it right at no cost.',
    coverage: 'Parts + labor + performance guarantee',
    term: 'Lifetime',
    price: 1495,
    imageUrl: '/images/warranties/total-comfort.jpg',
  },
];

// ── Common Discounts ────────────────────────────────────────────────

export const discountsCatalog: Discount[] = [
  { id: 'senior', name: 'Senior Discount (65+)', type: 'percent', amount: 5 },
  { id: 'military', name: 'Military / First Responder', type: 'percent', amount: 5 },
  { id: 'repeat', name: 'Repeat Customer', type: 'flat', amount: 250 },
  { id: 'referral', name: 'Referral Credit', type: 'flat', amount: 200 },
  { id: 'membership', name: 'Membership Discount', type: 'percent', amount: 10 },
  { id: 'bundle', name: 'System Bundle Discount', type: 'flat', amount: 500 },
  { id: 'seasonal', name: 'Seasonal Promotion', type: 'flat', amount: 300 },
];

// ── Packages ────────────────────────────────────────────────────────

export const packagesCatalog: Package[] = [
  {
    id: 'pkg-ac-furnace-good',
    name: 'Standard Comfort System',
    description: 'Reliable AC + Furnace replacement with essential install materials. Budget-friendly.',
    tier: 'good',
    imageUrl: '/images/packages/standard-system.jpg',
    equipment: [
      equipmentCatalog.find(e => e.id === 'ac-good')!,
      equipmentCatalog.find(e => e.id === 'furnace-good')!,
    ],
    addOns: [
      addOnsCatalog.find(a => a.id === 'surge-protector')!,
    ],
    installItems: [
      { ...installItemsCatalog.find(i => i.id === 'lineset-3/8-3/4')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condenser-pad')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'drain-pan')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'float-switch')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disconnect')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'whip-6ft')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'filter-drier')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'pvc-drain')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disposal')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'misc-supplies')!, quantity: 1 },
    ],
    warranties: [
      warrantiesCatalog.find(w => w.id === 'labor-5yr')!,
    ],
    laborCost: 2200,
  },
  {
    id: 'pkg-ac-furnace-better',
    name: 'Enhanced Comfort System',
    description: 'Higher efficiency AC + Furnace with smart thermostat, air quality, and extended warranty.',
    tier: 'better',
    imageUrl: '/images/packages/enhanced-system.jpg',
    equipment: [
      equipmentCatalog.find(e => e.id === 'ac-better')!,
      equipmentCatalog.find(e => e.id === 'furnace-better')!,
    ],
    addOns: [
      addOnsCatalog.find(a => a.id === 'smart-thermostat')!,
      addOnsCatalog.find(a => a.id === 'surge-protector')!,
      addOnsCatalog.find(a => a.id === 'uv-light')!,
    ],
    installItems: [
      { ...installItemsCatalog.find(i => i.id === 'lineset-3/8-3/4')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condenser-pad')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'drain-pan')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'float-switch')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disconnect')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'whip-6ft')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'filter-drier')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'thermostat-wire')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'pvc-drain')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disposal')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'permit')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'misc-supplies')!, quantity: 1 },
    ],
    warranties: [
      warrantiesCatalog.find(w => w.id === 'labor-10yr')!,
    ],
    laborCost: 2800,
  },
  {
    id: 'pkg-ac-furnace-best',
    name: 'Premium Comfort System',
    description: 'Top-of-the-line AC + Furnace with complete air quality, smart home, and lifetime guarantee.',
    tier: 'best',
    imageUrl: '/images/packages/premium-system.jpg',
    equipment: [
      equipmentCatalog.find(e => e.id === 'ac-best')!,
      equipmentCatalog.find(e => e.id === 'furnace-best')!,
    ],
    addOns: [
      addOnsCatalog.find(a => a.id === 'smart-thermostat')!,
      addOnsCatalog.find(a => a.id === 'air-scrubber')!,
      addOnsCatalog.find(a => a.id === 'surge-protector')!,
      addOnsCatalog.find(a => a.id === 'media-filter')!,
    ],
    installItems: [
      { ...installItemsCatalog.find(i => i.id === 'lineset-3/8-7/8')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condenser-pad')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'drain-pan')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'float-switch')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condensate-pump')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disconnect')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'whip-6ft')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'filter-drier')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'thermostat-wire')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'pvc-drain')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disposal')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'permit')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'nitrogen')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'misc-supplies')!, quantity: 1 },
    ],
    warranties: [
      warrantiesCatalog.find(w => w.id === 'total-comfort')!,
    ],
    laborCost: 3400,
  },
  // ── Heat Pump Packages ─────────────────────────────────────────
  {
    id: 'pkg-hp-good',
    name: 'Standard Heat Pump System',
    description: 'All-in-one heating and cooling with basic install package.',
    tier: 'good',
    imageUrl: '/images/packages/hp-standard.jpg',
    equipment: [
      equipmentCatalog.find(e => e.id === 'hp-good')!,
    ],
    addOns: [
      addOnsCatalog.find(a => a.id === 'surge-protector')!,
    ],
    installItems: [
      { ...installItemsCatalog.find(i => i.id === 'lineset-3/8-3/4')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condenser-pad')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disconnect')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'whip-6ft')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'filter-drier')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disposal')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'misc-supplies')!, quantity: 1 },
    ],
    warranties: [
      warrantiesCatalog.find(w => w.id === 'labor-5yr')!,
    ],
    laborCost: 2000,
  },
  {
    id: 'pkg-hp-best',
    name: 'Premium Heat Pump System',
    description: 'Top-tier inverter heat pump with full accessories and lifetime guarantee.',
    tier: 'best',
    imageUrl: '/images/packages/hp-premium.jpg',
    equipment: [
      equipmentCatalog.find(e => e.id === 'hp-best')!,
    ],
    addOns: [
      addOnsCatalog.find(a => a.id === 'smart-thermostat')!,
      addOnsCatalog.find(a => a.id === 'air-scrubber')!,
      addOnsCatalog.find(a => a.id === 'surge-protector')!,
    ],
    installItems: [
      { ...installItemsCatalog.find(i => i.id === 'lineset-3/8-7/8')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'condenser-pad')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disconnect')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'whip-6ft')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'filter-drier')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'thermostat-wire')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'disposal')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'permit')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'nitrogen')!, quantity: 1 },
      { ...installItemsCatalog.find(i => i.id === 'misc-supplies')!, quantity: 1 },
    ],
    warranties: [
      warrantiesCatalog.find(w => w.id === 'total-comfort')!,
    ],
    laborCost: 3200,
  },
];

// ── Financing ───────────────────────────────────────────────────────

export const financingTerms: FinancingTerm[] = [
  { id: 'promo-0', name: '0% for 18 Months', months: 18, apr: 0, minAmount: 1000 },
  { id: 'promo-60', name: '6.99% for 60 Months', months: 60, apr: 6.99, minAmount: 3000 },
  { id: 'promo-84', name: '7.99% for 84 Months', months: 84, apr: 7.99, minAmount: 5000 },
  { id: 'promo-120', name: '8.99% for 120 Months', months: 120, apr: 8.99, minAmount: 5000 },
];
