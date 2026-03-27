// Business type definitions for onboarding wizard.
// Maps high-level business types to catalog category slugs.

export interface BusinessType {
  id: string;
  label: string;
  description: string;
  icon: string; // emoji
  categorySlugs: string[];
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'lawn_landscape',
    label: 'Lawn & Landscape',
    description: 'Mowing, fertilization, landscaping, hardscaping',
    icon: '🌿',
    categorySlugs: ['lawn-and-turf', 'landscaping-and-hardscaping'],
  },
  {
    id: 'fencing',
    label: 'Fencing',
    description: 'Wood, iron, and metal fence installation & repair',
    icon: '🏗️',
    categorySlugs: ['fencing'],
  },
  {
    id: 'paving',
    label: 'Paving & Concrete',
    description: 'Driveways, walkways, concrete leveling',
    icon: '🛤️',
    categorySlugs: ['driveway-and-walkways'],
  },
  {
    id: 'pool',
    label: 'Pool & Outdoor Living',
    description: 'Pool maintenance, pergolas, outdoor kitchens',
    icon: '🏊',
    categorySlugs: ['pool-and-outdoor-living'],
  },
  {
    id: 'roofing',
    label: 'Roofing',
    description: 'Roof replacement, repair, inspection, coatings',
    icon: '🏠',
    categorySlugs: ['roofing'],
  },
  {
    id: 'siding_exterior',
    label: 'Siding & Exterior',
    description: 'Siding, brick repair, exterior painting, power washing',
    icon: '🧱',
    categorySlugs: ['siding-exterior-walls'],
  },
  {
    id: 'windows_doors',
    label: 'Windows & Doors',
    description: 'Window replacement, doors, garage doors',
    icon: '🪟',
    categorySlugs: ['windows-doors'],
  },
  {
    id: 'foundation',
    label: 'Foundation',
    description: 'Foundation inspection, pier repair, drainage',
    icon: '🏗️',
    categorySlugs: ['foundation'],
  },
  {
    id: 'gutters',
    label: 'Gutters',
    description: 'Gutter cleaning, installation, guards',
    icon: '🌧️',
    categorySlugs: ['gutters'],
  },
  {
    id: 'insulation',
    label: 'Insulation',
    description: 'Attic insulation, radiant barriers, weatherproofing',
    icon: '🧊',
    categorySlugs: ['insulation-weatherproofing'],
  },
  {
    id: 'hvac',
    label: 'HVAC',
    description: 'AC, heating, ductwork, air quality',
    icon: '❄️',
    categorySlugs: ['hvac'],
  },
  {
    id: 'plumbing',
    label: 'Plumbing',
    description: 'Water heaters, drains, pipes, fixtures',
    icon: '🔧',
    categorySlugs: ['plumbing'],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    description: 'Panel upgrades, wiring, lighting, EV chargers',
    icon: '⚡',
    categorySlugs: ['electrical'],
  },
  {
    id: 'painting_finishes',
    label: 'Painting & Finishes',
    description: 'Interior painting, flooring, cabinets, countertops',
    icon: '🎨',
    categorySlugs: ['interior-finishes'],
  },
  {
    id: 'appliance_repair',
    label: 'Appliance Repair',
    description: 'Appliance installation and repair',
    icon: '🔌',
    categorySlugs: ['appliances'],
  },
  {
    id: 'pest_control',
    label: 'Pest Control',
    description: 'General pest control, termite treatment',
    icon: '🐛',
    categorySlugs: ['pest-control'],
  },
];

// Get all category slugs for given business type IDs
export function getCategorySlugsForTypes(typeIds: string[]): string[] {
  const slugs = new Set<string>();
  for (const typeId of typeIds) {
    const bt = BUSINESS_TYPES.find((t) => t.id === typeId);
    if (bt) {
      for (const slug of bt.categorySlugs) {
        slugs.add(slug);
      }
    }
  }
  return Array.from(slugs);
}

// Default cost structure benchmarks for DFW market
export const DFW_BENCHMARKS = {
  labor: { default: 35, min: 20, max: 55, label: 'DFW avg 30-40%' },
  materials: { default: 20, min: 5, max: 45, label: 'DFW avg 15-25%' },
  overhead: { default: 20, min: 10, max: 35, label: 'DFW avg 15-25%' },
  profit: { default: 15, min: 5, max: 30, label: 'Industry 10-20%' },
} as const;
