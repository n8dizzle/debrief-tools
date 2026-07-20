// NOTE: Suppliers are now managed in Settings (pe_suppliers table), fetched via
// /api/suppliers. See app/settings/suppliers and useOrders.suppliers.

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

// Locations (physical places) are now manager-editable and DB-backed
// (pe_locations via /api/locations + useOrders().locations).

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

// NOTE: Install teams are now managed in Settings (pe_install_teams table),
// fetched via /api/install-teams. See app/settings and useOrders.installTeams.

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
