export const SUPPLIERS = [
  'AACA Lewisville',
  'AC Supply - FW',
  'AC Supply - N. FW',
  'Amazon',
  'American Standard',
  'AMSCO',
  'Baker - Denton',
  'Baker - Lewisville',
  'Barsco',
  'CE - Allen',
  'CE - Carr',
  'CE - Dallas',
  'CE - Denton',
  'CE - FW',
  'CE - Garland',
  'CE - Sherman',
  'CE - SW FW',
  'Century Supply - Dallas',
  'Century Supply - Fort Worth',
  'Century Supply - Richardson',
  'Ferguson',
  'FISSCO Supply',
  'Gemaire',
  'Goodman - Allen',
  'Goodman - Carrollton',
  'Goodman - Denton',
  'Goodman - N. FW',
  'Home Depot',
  'INSCO',
  'Johnson',
  'Johnstone Supply',
  'Lennox - Allen',
  'Lennox - Carrollton',
  'Lennox - FW',
  'Lennox - Garland',
  'Lennox - Grand Prairie',
  'Lennox - Lewisville',
  'Lennox - Southlake',
  'Locke',
  'M&M Metals',
  'None',
  'Reece - Carrollton',
  'Reece - Denton',
  'Reece - Garland',
  'RepairClinic.com',
  'Robert Madden',
  'Shearer - Allen',
  'Shearer - Carrollton',
  'Shearer - Denton',
  'Shearer - FW',
  'Standard Supply',
  'Standard Supply - FW',
  'Stock',
  'SupplyHouse.com',
  'Trane',
  'United Refrigeration',
  'WinSupply',
  'Other',
];

export const OWNERS = [
  'Install Dispatcher',
  'Warehouse',
  'Service Manager',
  'CXR Team',
  'Parts Coordinator',
  'Install Manager',
  'Service Dispatcher',
  'Plumbing Dispatcher',
  'Commercial',
  'Unassigned',
];

export interface OwnerConfig {
  name: string;
  dot: string;
}

export const SVC_OWNERS_CONFIG: OwnerConfig[] = [
  { name: 'Parts Coordinator', dot: '#00838f' },
  { name: 'Warehouse', dot: '#1976d2' },
  { name: 'CXR Team', dot: '#6a0dad' },
  { name: 'Service Dispatcher', dot: '#a1887f' },
  { name: 'Service Manager', dot: '#c0392b' },
  { name: 'Install Dispatcher', dot: '#c2185b' },
  { name: 'Plumbing Dispatcher', dot: '#ef6c00' },
  { name: 'Unassigned', dot: '#95a5a6' },
];

export const INST_OWNERS_CONFIG: OwnerConfig[] = [
  { name: 'Install Manager', dot: '#1b5e20' },
  { name: 'Parts Coordinator', dot: '#00838f' },
  { name: 'Warehouse', dot: '#1976d2' },
  { name: 'Install Dispatcher', dot: '#880e4f' },
  { name: 'Unassigned', dot: '#95a5a6' },
];

export const LOCATIONS = [
  'Place Order',
  'Shipping to Shop',
  'Lewisville Shop',
  'Backordered',
  'P/U Supply House',
  'Waiting for Customer',
  'Waiting for Tech/Cus',
  'Cancel PO',
  'Shipping to Supplier',
  'Duct Cleaning - Schedule',
  'Completed',
];

export const INSTALL_LOCATIONS = [
  'Place Order',
  'Shipping to Shop',
  'Lewisville Shop',
  'Backordered',
  'P/U Supply House',
  'Waiting for Customer',
  'Cancel PO',
];

export const TECHS = [
  'Ash',
  'Bill',
  'Braulio',
  'Demetrius',
  'Dylan',
  'Eduardo',
  'Eric',
  'Jack',
  'Jacob',
  'Jonathan (JP)',
  'Kaileb',
  'Keith',
  'Microphil (Phil)',
  'Ozzy',
  'Santiago',
  'Walter',
  'David',
  'Garrick',
  'Syres',
  'Brett',
  'Luke',
  'Christina',
  'John',
  'Daniel',
  'Other',
];

export const INSTALL_TEAMS = [
  'Team A',
  'Team B',
  'Team C',
  'Team D',
  'Team E',
  'Sub',
];

export const SVC_SUBTYPES = [
  'Service',
  'Plumbing',
  'Duct Cleaning',
  'Membership',
  'Other',
];

// Options for the Parts/Repair column (stored in the tech_type field).
export const PARTS_REPAIR = ['Parts', 'Repair'];

export const INST_SUBTYPES = [
  'HVAC Install',
  'Plumbing Install',
  'Duct Install',
  'IAQ Install',
  'Other',
];

export const WARRANTY_TYPES = ['P', 'L', 'P/L'];

export const CANCEL_REASONS = [
  'Customer declined',
  'Customer cancelled job',
  'Part not needed',
  'Wrong part ordered',
  'Found part locally',
  'Warranty replacement',
  'Duplicate order',
  'Job completed without part',
  'Other',
];
