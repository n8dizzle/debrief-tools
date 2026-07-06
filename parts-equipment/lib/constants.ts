export const SUPPLIERS = [
  'Johnstone',
  'Winsupply',
  'Ferguson',
  'Daikin',
  'Carrier',
  'Trane',
  'Lennox',
  'Rheem',
  'Goodman',
  'York',
  'Amana',
  'Bryant',
  'Heil',
  'ADP',
  'Mitsubishi',
  'Fujitsu',
  'LG',
  'Bosch',
  'American Standard',
  'Ruud',
  'Nordyne',
  'ICP',
  'Allied',
  'Grandaire',
  'Concord',
  'Tempstar',
  'Keeprite',
  'Comfortmaker',
  'Arcoaire',
  'Day & Night',
  'National Comfort Products',
  'Emerson',
  'White-Rodgers',
  'Honeywell',
  'Ecobee',
  'Nest',
  'iComfort',
  'Infinity',
  'Navien',
  'Rinnai',
  'Noritz',
  'Bradford White',
  'A.O. Smith',
  'State Water Heaters',
  'Other',
];

export const OWNERS = [
  'Service Dispatcher',
  'Warehouse',
  'CXR Team',
  'Install Manager',
  'Install Dispatcher',
  'Plumbing Dispatch',
  'Parts Coordinator',
  'Service Manager',
  'Unassigned',
];

export interface OwnerConfig {
  name: string;
  dot: string;
}

export const SVC_OWNERS_CONFIG: OwnerConfig[] = [
  { name: 'Service Dispatcher', dot: '#e65100' },
  { name: 'Warehouse', dot: '#1976d2' },
  { name: 'CXR Team', dot: '#6a0dad' },
  { name: 'Service Manager', dot: '#1565c0' },
  { name: 'Install Dispatcher', dot: '#880e4f' },
  { name: 'Plumbing Dispatch', dot: '#1a9aaa' },
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
