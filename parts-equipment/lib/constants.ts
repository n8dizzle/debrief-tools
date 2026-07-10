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
  'Parts Coordinator',
  'Service Manager',
  'Rachel',
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
  { name: 'Rachel', dot: '#1a9aaa' },
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
  'Chris',
  'Brandon',
  'Derek',
  'Edgar',
  'George',
  'Ivan',
  'Jason',
  'Jesse',
  'Joel',
  'Jose',
  'Josh',
  'Juan',
  'Kevin',
  'Luis',
  'Marco',
  'Mark',
  'Michael',
  'Mike',
  'Nathan',
  'Pedro',
  'Robert',
  'Ron',
  'Scott',
  'Steve',
  'Tim',
  'Todd',
  'Tony',
  'Victor',
  'Other',
];

// NOTE: Install teams are now managed in Settings (pe_install_teams table),
// fetched via /api/install-teams. See app/settings and useOrders.installTeams.

export const SVC_SUBTYPES = [
  'HVAC',
  'Plumbing',
  'Duct',
  'IAQ',
  'Electrical',
  'Other',
];

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
