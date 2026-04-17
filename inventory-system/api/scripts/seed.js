'use strict';

/**
 * seed.js — populate the database with initial data.
 *
 * Usage:
 *   node scripts/seed.js            # seed all tables
 *   node scripts/seed.js --wipe     # DROP + re-seed (DANGER: clears all data)
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING for all rows
 * so running twice won't duplicate data.
 */

require('dotenv').config();

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const WIPE = process.argv.includes('--wipe');

// ── Seed data ─────────────────────────────────────────────────────────────────

const WAREHOUSES = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'Lewisville', department: 'plumbing',
    address: '1200 Lakeside Pkwy', city: 'Lewisville', state: 'TX', zip: '75057', status: 'active' },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'Argyle', department: 'hvac',
    address: '400 Canyon Lakes Dr', city: 'Argyle', state: 'TX', zip: '76226', status: 'active' },
];

const TRUCKS = [
  { id: 'b1000000-0000-0000-0000-000000000001', truck_number: 'P-01', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', status: 'active' },
  { id: 'b1000000-0000-0000-0000-000000000002', truck_number: 'P-02', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', status: 'active' },
  { id: 'b1000000-0000-0000-0000-000000000003', truck_number: 'P-03', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', status: 'inactive' },
  { id: 'b1000000-0000-0000-0000-000000000004', truck_number: 'H-01', department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002', status: 'active' },
  { id: 'b1000000-0000-0000-0000-000000000005', truck_number: 'H-02', department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002', status: 'active' },
  { id: 'b1000000-0000-0000-0000-000000000006', truck_number: 'H-03', department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002', status: 'active' },
];

const SUPPLY_HOUSES = [
  { id: 'c1000000-0000-0000-0000-000000000001', name: 'Ferguson Plumbing Supply', account_number: 'FPS-44821', contact_name: 'Mark Ellis',    contact_email: 'mark.ellis@ferguson.com',    contact_phone: '972-555-1001', department: 'plumbing', lead_time_days: 2 },
  { id: 'c1000000-0000-0000-0000-000000000002', name: 'Hajoca Corporation',        account_number: 'HAJ-90034', contact_name: 'Sandra Wu',     contact_email: 'swu@hajoca.com',             contact_phone: '972-555-1002', department: 'plumbing', lead_time_days: 3 },
  { id: 'c1000000-0000-0000-0000-000000000003', name: 'Johnstone Supply',          account_number: 'JOH-77123', contact_name: 'David Park',    contact_email: 'dpark@johnstone.com',        contact_phone: '940-555-2001', department: 'hvac',     lead_time_days: 1 },
  { id: 'c1000000-0000-0000-0000-000000000004', name: 'Carrier Enterprise',        account_number: 'CAR-55002', contact_name: 'Lisa Nguyen',   contact_email: 'lnguyen@carrier.com',        contact_phone: '940-555-2002', department: 'hvac',     lead_time_days: 5 },
  { id: 'c1000000-0000-0000-0000-000000000005', name: 'Waxman Consumer Products',  account_number: 'WAX-30071', contact_name: 'Tom Rivera',    contact_email: 'trivera@waxman.com',         contact_phone: '972-555-1003', department: 'plumbing', lead_time_days: 2 },
  { id: 'c1000000-0000-0000-0000-000000000006', name: 'Grainger',                  account_number: 'GRG-12980', contact_name: 'Amy Chen',      contact_email: 'achen@grainger.com',         contact_phone: '800-555-3001', department: 'all',      lead_time_days: 2 },
];

// Users — passwords hashed below in main()
const USER_SEEDS = [
  { id: 'd1000000-0000-0000-0000-000000000001', first_name: 'Ray',    last_name: 'Davis',   email: 'admin@christmasair.com', password: 'admin123', role: 'admin',   department: 'all',      home_warehouse_id: null,                                       assigned_truck_id: null },
  { id: 'd1000000-0000-0000-0000-000000000002', first_name: 'Jordan', last_name: 'Lee',     email: 'mgr@christmasair.com',   password: 'pass123',  role: 'manager', department: 'all',      home_warehouse_id: null,                                       assigned_truck_id: null },
  { id: 'd1000000-0000-0000-0000-000000000003', first_name: 'Carlos', last_name: 'Mendez',  email: 'carlos@christmasair.com',password: 'pass123',  role: 'tech',    department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001',    assigned_truck_id: 'b1000000-0000-0000-0000-000000000001' },
  { id: 'd1000000-0000-0000-0000-000000000004', first_name: 'Mike',   last_name: 'Torres',  email: 'mike@christmasair.com',  password: 'pass123',  role: 'tech',    department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001',    assigned_truck_id: 'b1000000-0000-0000-0000-000000000002' },
  { id: 'd1000000-0000-0000-0000-000000000005', first_name: 'Sam',    last_name: 'Park',    email: 'sam@christmasair.com',   password: 'pass123',  role: 'tech',    department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002',    assigned_truck_id: 'b1000000-0000-0000-0000-000000000004' },
  { id: 'd1000000-0000-0000-0000-000000000006', first_name: 'David',  last_name: 'Kim',     email: 'david@christmasair.com', password: 'pass123',  role: 'tech',    department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002',    assigned_truck_id: 'b1000000-0000-0000-0000-000000000005' },
  { id: 'd1000000-0000-0000-0000-000000000007', first_name: 'Lisa',   last_name: 'Chen',    email: 'lisa@christmasair.com',  password: 'pass123',  role: 'tech',    department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002',    assigned_truck_id: 'b1000000-0000-0000-0000-000000000006' },
];

const MATERIALS = [
  // Plumbing
  { id: 'e1000000-0000-0000-0000-000000000001', name: '3/4" SharkBite Push-to-Connect Coupling',  sku: 'PLM-SB-3/4C',  barcode: '4011000010001', unit_of_measure: 'EA',  department: 'plumbing', category: 'fittings',    unit_cost: 8.49,  reorder_point: 20, reorder_quantity: 50, max_stock: 100, primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000002', name: '1/2" x 20ft CPVC Pipe',                    sku: 'PLM-CPVC-1/2', barcode: '4011000010002', unit_of_measure: 'EA',  department: 'plumbing', category: 'pipe',        unit_cost: 14.99, reorder_point: 10, reorder_quantity: 25, max_stock: 50,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000003', name: 'Wax Ring w/ Flange',                        sku: 'PLM-WR-FL',   barcode: '4011000010003', unit_of_measure: 'EA',  department: 'plumbing', category: 'toilet',      unit_cost: 6.25,  reorder_point: 10, reorder_quantity: 24, max_stock: 48,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000005' },
  { id: 'e1000000-0000-0000-0000-000000000004', name: 'Fluidmaster 400A Fill Valve',               sku: 'PLM-FM-400A',  barcode: '4011000010004', unit_of_measure: 'EA',  department: 'plumbing', category: 'toilet',      unit_cost: 11.75, reorder_point: 8,  reorder_quantity: 20, max_stock: 40,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000005' },
  { id: 'e1000000-0000-0000-0000-000000000005', name: '3/4" Ball Valve FPT Brass',                 sku: 'PLM-BV-3/4B',  barcode: '4011000010005', unit_of_measure: 'EA',  department: 'plumbing', category: 'valves',      unit_cost: 18.50, reorder_point: 6,  reorder_quantity: 15, max_stock: 30,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000006', name: 'Teflon Thread Seal Tape 1/2" x 520"',       sku: 'PLM-TFLN-520', barcode: '4011000010006', unit_of_measure: 'RL',  department: 'plumbing', category: 'sealants',    unit_cost: 1.89,  reorder_point: 30, reorder_quantity: 72, max_stock: 144, primary_supply_house_id: 'c1000000-0000-0000-0000-000000000005' },
  { id: 'e1000000-0000-0000-0000-000000000007', name: 'P-Trap 1-1/2" PVC',                         sku: 'PLM-PT-1.5P',  barcode: '4011000010007', unit_of_measure: 'EA',  department: 'plumbing', category: 'drains',      unit_cost: 4.75,  reorder_point: 12, reorder_quantity: 30, max_stock: 60,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000008', name: '40-Gal Water Heater Anode Rod',             sku: 'PLM-AR-40G',   barcode: '4011000010008', unit_of_measure: 'EA',  department: 'plumbing', category: 'water_heater',unit_cost: 22.00, reorder_point: 5,  reorder_quantity: 12, max_stock: 24,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000009', name: 'Expansion Tank 2-Gal',                      sku: 'PLM-ET-2G',    barcode: '4011000010009', unit_of_measure: 'EA',  department: 'plumbing', category: 'water_heater',unit_cost: 45.00, reorder_point: 3,  reorder_quantity: 8,  max_stock: 16,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  { id: 'e1000000-0000-0000-0000-000000000010', name: 'Pressure Relief Valve 3/4" 150PSI',          sku: 'PLM-PRV-3/4',  barcode: '4011000010010', unit_of_measure: 'EA',  department: 'plumbing', category: 'valves',      unit_cost: 14.25, reorder_point: 6,  reorder_quantity: 15, max_stock: 30,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000001' },
  // HVAC
  { id: 'e1000000-0000-0000-0000-000000000011', name: '16x25x1 MERV-8 Air Filter',                 sku: 'HVC-AF-16251', barcode: '4011000020001', unit_of_measure: 'EA',  department: 'hvac',     category: 'filters',     unit_cost: 7.50,  reorder_point: 20, reorder_quantity: 48, max_stock: 96,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000012', name: '20x25x1 MERV-11 Air Filter',                sku: 'HVC-AF-20251', barcode: '4011000020002', unit_of_measure: 'EA',  department: 'hvac',     category: 'filters',     unit_cost: 9.25,  reorder_point: 15, reorder_quantity: 36, max_stock: 72,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000013', name: 'R-410A Refrigerant 25lb Cylinder',           sku: 'HVC-REF-410A', barcode: '4011000020003', unit_of_measure: 'CYL', department: 'hvac',     category: 'refrigerant', unit_cost: 185.00,reorder_point: 2,  reorder_quantity: 5,  max_stock: 10,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000004' },
  { id: 'e1000000-0000-0000-0000-000000000014', name: 'Capacitor 45/5 MFD 440VAC',                 sku: 'HVC-CAP-455',  barcode: '4011000020004', unit_of_measure: 'EA',  department: 'hvac',     category: 'electrical',  unit_cost: 22.50, reorder_point: 10, reorder_quantity: 24, max_stock: 48,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000015', name: 'Contactor 24V 40A Single Pole',              sku: 'HVC-CTR-24V1',  barcode: '4011000020005', unit_of_measure: 'EA',  department: 'hvac',     category: 'electrical',  unit_cost: 34.00, reorder_point: 8,  reorder_quantity: 20, max_stock: 40,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000016', name: 'Condenser Fan Motor 1/4HP 208-230V',         sku: 'HVC-CFM-25H',  barcode: '4011000020006', unit_of_measure: 'EA',  department: 'hvac',     category: 'motors',      unit_cost: 89.00, reorder_point: 4,  reorder_quantity: 10, max_stock: 20,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000017', name: 'Drain Pan Tablets (30-pack)',                 sku: 'HVC-DPT-30',   barcode: '4011000020007', unit_of_measure: 'PK',  department: 'hvac',     category: 'maintenance', unit_cost: 12.00, reorder_point: 10, reorder_quantity: 24, max_stock: 48,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000018', name: 'Thermostat Honeywell T6 Pro',                sku: 'HVC-TST-T6P',  barcode: '4011000020008', unit_of_measure: 'EA',  department: 'hvac',     category: 'controls',    unit_cost: 65.00, reorder_point: 3,  reorder_quantity: 8,  max_stock: 16,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000019', name: 'Condensate Drain Line Clear Tabs',           sku: 'HVC-CDT-CLR',  barcode: '4011000020009', unit_of_measure: 'PK',  department: 'hvac',     category: 'maintenance', unit_cost: 8.75,  reorder_point: 12, reorder_quantity: 30, max_stock: 60,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
  { id: 'e1000000-0000-0000-0000-000000000020', name: '3/4" PVC Condensate Line 10ft',              sku: 'HVC-CL-3/4PVC', barcode: '4011000020010',unit_of_measure: 'EA',  department: 'hvac',     category: 'drain',       unit_cost: 6.50,  reorder_point: 10, reorder_quantity: 25, max_stock: 50,  primary_supply_house_id: 'c1000000-0000-0000-0000-000000000003' },
];

// Warehouse stock: each material in its home warehouse
function buildWarehouseStock() {
  return MATERIALS.map((m, i) => ({
    material_id:      m.id,
    warehouse_id:     m.department === 'plumbing'
                        ? 'a1000000-0000-0000-0000-000000000001'
                        : 'a1000000-0000-0000-0000-000000000002',
    quantity_on_hand: 15 + (i * 7) % 60,
    quantity_reserved: 0,
  }));
}

// Truck stock: first 8 materials on P-01, first 8 HVAC materials on H-01
function buildTruckStock() {
  const rows = [];
  MATERIALS.slice(0, 8).forEach((m, i) => {
    rows.push({ material_id: m.id, truck_id: 'b1000000-0000-0000-0000-000000000001', quantity_on_hand: 2 + (i * 3) % 8 });
    rows.push({ material_id: m.id, truck_id: 'b1000000-0000-0000-0000-000000000002', quantity_on_hand: 1 + i % 5 });
  });
  MATERIALS.slice(10, 18).forEach((m, i) => {
    rows.push({ material_id: m.id, truck_id: 'b1000000-0000-0000-0000-000000000004', quantity_on_hand: 2 + (i * 2) % 7 });
    rows.push({ material_id: m.id, truck_id: 'b1000000-0000-0000-0000-000000000005', quantity_on_hand: 1 + i % 4 });
  });
  return rows;
}

const TOOLS = [
  { id: 'f1000000-0000-0000-0000-000000000001', name: 'Milwaukee M18 Drill',       manufacturer: 'Milwaukee', model: 'M18 FUEL', serial_number: 'MIL-001-2022', barcode: '5011000001', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', category: 'power_tool',   current_condition: 'good',      status: 'available',       purchase_date: '2022-03-15', purchase_cost: 189.00 },
  { id: 'f1000000-0000-0000-0000-000000000002', name: 'Pipe Wrench 18"',           manufacturer: 'Ridgid',    model: '31025',    serial_number: 'PW-18-004',    barcode: '5011000002', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', category: 'hand_tool',    current_condition: 'good',      status: 'checked_out',     purchase_date: '2021-06-01', purchase_cost: 74.99,  checked_out_to: 'd1000000-0000-0000-0000-000000000003' },
  { id: 'f1000000-0000-0000-0000-000000000003', name: 'Drain Snake 50ft',          manufacturer: 'Ryobi',     model: 'RMT50',    serial_number: 'DS-50-002',    barcode: '5011000003', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', category: 'specialty',    current_condition: 'fair',      status: 'out_for_service',  purchase_date: '2020-11-10', purchase_cost: 229.00, service_notes: 'Cable frayed — needs replacement' },
  { id: 'f1000000-0000-0000-0000-000000000004', name: 'HVAC Manifold Gauge Set',   manufacturer: 'Yellow Jacket', model: '49967', serial_number: 'MG-AC-009',  barcode: '5011000004', department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002', category: 'specialty',    current_condition: 'excellent', status: 'available',       purchase_date: '2023-01-20', purchase_cost: 310.00 },
  { id: 'f1000000-0000-0000-0000-000000000005', name: 'Refrigerant Recovery Machine', manufacturer: 'Robinair', model: '34788', serial_number: 'RM-01-2021',  barcode: '5011000005', department: 'hvac',     home_warehouse_id: 'a1000000-0000-0000-0000-000000000002', category: 'specialty',    current_condition: 'good',      status: 'checked_out',     purchase_date: '2021-02-14', purchase_cost: 995.00, checked_out_to: 'd1000000-0000-0000-0000-000000000005' },
  { id: 'f1000000-0000-0000-0000-000000000006', name: 'Pipe Cutter 1/8-2"',        manufacturer: 'Ridgid',    model: '32820',    serial_number: 'PC-2-007',     barcode: '5011000006', department: 'plumbing', home_warehouse_id: 'a1000000-0000-0000-0000-000000000001', category: 'hand_tool',    current_condition: 'poor',      status: 'retired',         purchase_date: '2019-04-22', purchase_cost: 59.99 },
];

const EQUIPMENT = [
  { id: 'g1000000-0000-0000-0000-000000000001', name: 'Carrier 3-Ton AC Unit',       manufacturer: 'Carrier',    model: '24ACC336A003', serial_number: 'CAR-SN-001', category: 'air_conditioner', department: 'hvac',     warehouse_id: 'a1000000-0000-0000-0000-000000000002', status: 'active', condition: 'good',      installation_date: '2022-05-10', warranty_expiry: '2027-05-10' },
  { id: 'g1000000-0000-0000-0000-000000000002', name: 'Rheem 50-Gal Water Heater',   manufacturer: 'Rheem',      model: 'XE50T12CS55U1', serial_number: 'RHM-SN-002', category: 'water_heater',    department: 'plumbing', warehouse_id: 'a1000000-0000-0000-0000-000000000001', status: 'active', condition: 'good',      installation_date: '2023-01-15', warranty_expiry: '2029-01-15' },
  { id: 'g1000000-0000-0000-0000-000000000003', name: 'Trane XR15 Heat Pump',        manufacturer: 'Trane',      model: '4TWR5036',     serial_number: 'TRN-SN-003', category: 'heat_pump',       department: 'hvac',     warehouse_id: 'a1000000-0000-0000-0000-000000000002', status: 'needs_service', condition: 'fair', installation_date: '2019-09-22', warranty_expiry: '2024-09-22', next_service_due: '2026-05-01' },
  { id: 'g1000000-0000-0000-0000-000000000004', name: 'Bradford White 40-Gal WH',    manufacturer: 'Bradford White', model: 'M240S6DS', serial_number: 'BW-SN-004',  category: 'water_heater',    department: 'plumbing', warehouse_id: 'a1000000-0000-0000-0000-000000000001', status: 'active', condition: 'excellent', installation_date: '2024-03-08', warranty_expiry: '2030-03-08' },
];

const IT_ASSETS = [
  { id: 'h1000000-0000-0000-0000-000000000001', asset_type: 'phone',  manufacturer: 'Apple',   model: 'iPhone 15',       serial_number: 'IPHONE-001', asset_tag: 'IT-P001', department: 'plumbing', purchase_date: '2023-09-20', purchase_cost: 799.00, warranty_expiry: '2024-09-20', mdm_enrolled: true,  status: 'assigned', assigned_to: 'd1000000-0000-0000-0000-000000000003' },
  { id: 'h1000000-0000-0000-0000-000000000002', asset_type: 'tablet', manufacturer: 'Apple',   model: 'iPad 10th Gen',   serial_number: 'IPAD-001',   asset_tag: 'IT-T001', department: 'all',      purchase_date: '2023-10-15', purchase_cost: 599.00, warranty_expiry: '2024-10-15', mdm_enrolled: true,  status: 'assigned', assigned_to: 'd1000000-0000-0000-0000-000000000002' },
  { id: 'h1000000-0000-0000-0000-000000000003', asset_type: 'phone',  manufacturer: 'Samsung', model: 'Galaxy S24',       serial_number: 'SAM-S24-001', asset_tag: 'IT-P002', department: 'hvac',     purchase_date: '2024-02-10', purchase_cost: 749.00, warranty_expiry: '2025-02-10', mdm_enrolled: true,  status: 'assigned', assigned_to: 'd1000000-0000-0000-0000-000000000005' },
  { id: 'h1000000-0000-0000-0000-000000000004', asset_type: 'laptop', manufacturer: 'Dell',    model: 'Latitude 5540',    serial_number: 'DELL-001',   asset_tag: 'IT-L001', department: 'all',      purchase_date: '2023-06-01', purchase_cost: 1299.00, warranty_expiry: '2026-06-01', mdm_enrolled: false, status: 'available' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅  Connected to database\n');

  try {
    if (WIPE) {
      console.log('⚠️   --wipe flag detected — clearing all tables…');
      await client.query(`
        TRUNCATE it_asset_assignments, it_assets, tool_movements, tools,
                 equipment, material_movements, bin_items, tech_bins,
                 po_lines, purchase_orders, restock_lines, restock_batches,
                 truck_stock, warehouse_stock, materials, supply_houses,
                 st_jobs, app_settings,
                 users, trucks, warehouses, warehouse_locations
        CASCADE
      `);
      console.log('✅  Tables cleared\n');
    }

    // 1. Warehouses
    process.stdout.write('🏭  Seeding warehouses… ');
    for (const w of WAREHOUSES) {
      await client.query(
        `INSERT INTO warehouses (id, name, department, address, city, state, zip, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [w.id, w.name, w.department, w.address, w.city, w.state, w.zip, w.status]
      );
    }
    console.log(`✅  ${WAREHOUSES.length}`);

    // 2. Trucks
    process.stdout.write('🚛  Seeding trucks… ');
    for (const t of TRUCKS) {
      await client.query(
        `INSERT INTO trucks (id, truck_number, department, home_warehouse_id, status)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.truck_number, t.department, t.home_warehouse_id, t.status]
      );
    }
    console.log(`✅  ${TRUCKS.length}`);

    // 3. Supply Houses
    process.stdout.write('🏪  Seeding supply houses… ');
    for (const s of SUPPLY_HOUSES) {
      await client.query(
        `INSERT INTO supply_houses (id, name, account_number, contact_name, contact_email, contact_phone, department, lead_time_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.account_number, s.contact_name, s.contact_email, s.contact_phone, s.department, s.lead_time_days]
      );
    }
    console.log(`✅  ${SUPPLY_HOUSES.length}`);

    // 4. Users (hash passwords)
    process.stdout.write('👤  Seeding users… ');
    for (const u of USER_SEEDS) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, department,
                            home_warehouse_id, assigned_truck_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.first_name, u.last_name, u.email, hash, u.role, u.department,
         u.home_warehouse_id, u.assigned_truck_id]
      );
    }
    console.log(`✅  ${USER_SEEDS.length}`);

    // 5. Materials
    process.stdout.write('📦  Seeding materials… ');
    for (const m of MATERIALS) {
      await client.query(
        `INSERT INTO materials (id, name, sku, barcode, unit_of_measure, department, category,
                                unit_cost, reorder_point, reorder_quantity, max_stock, primary_supply_house_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.name, m.sku, m.barcode, m.unit_of_measure, m.department, m.category,
         m.unit_cost, m.reorder_point, m.reorder_quantity, m.max_stock, m.primary_supply_house_id]
      );
    }
    console.log(`✅  ${MATERIALS.length}`);

    // 6. Warehouse stock
    process.stdout.write('🗄️   Seeding warehouse stock… ');
    const warehouseStock = buildWarehouseStock();
    for (const ws of warehouseStock) {
      await client.query(
        `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand, quantity_reserved)
         VALUES ($1,$2,$3,$4) ON CONFLICT (material_id, warehouse_id, location_id) DO NOTHING`,
        [ws.material_id, ws.warehouse_id, ws.quantity_on_hand, ws.quantity_reserved]
      );
    }
    console.log(`✅  ${warehouseStock.length}`);

    // 7. Truck stock
    process.stdout.write('🚚  Seeding truck stock… ');
    const truckStock = buildTruckStock();
    for (const ts of truckStock) {
      await client.query(
        `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
         VALUES ($1,$2,$3) ON CONFLICT (material_id, truck_id) DO NOTHING`,
        [ts.material_id, ts.truck_id, ts.quantity_on_hand]
      );
    }
    console.log(`✅  ${truckStock.length}`);

    // 8. Tools
    process.stdout.write('🔧  Seeding tools… ');
    for (const t of TOOLS) {
      await client.query(
        `INSERT INTO tools (id, name, manufacturer, model, serial_number, barcode, department,
                            home_warehouse_id, category, current_condition, status,
                            checked_out_to, purchase_date, purchase_cost, service_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.manufacturer, t.model, t.serial_number, t.barcode, t.department,
         t.home_warehouse_id, t.category, t.current_condition, t.status,
         t.checked_out_to ?? null, t.purchase_date, t.purchase_cost, t.service_notes ?? null]
      );
    }
    console.log(`✅  ${TOOLS.length}`);

    // 9. Equipment
    process.stdout.write('⚙️   Seeding equipment… ');
    for (const e of EQUIPMENT) {
      await client.query(
        `INSERT INTO equipment (id, name, manufacturer, model, serial_number, category, department,
                                warehouse_id, status, condition, installation_date, warranty_expiry,
                                next_service_due)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.name, e.manufacturer, e.model, e.serial_number, e.category, e.department,
         e.warehouse_id, e.status, e.condition, e.installation_date, e.warranty_expiry,
         e.next_service_due ?? null]
      );
    }
    console.log(`✅  ${EQUIPMENT.length}`);

    // 10. IT Assets
    process.stdout.write('💻  Seeding IT assets… ');
    for (const a of IT_ASSETS) {
      await client.query(
        `INSERT INTO it_assets (id, asset_type, manufacturer, model, serial_number, asset_tag,
                                department, purchase_date, purchase_cost, warranty_expiry,
                                mdm_enrolled, status, assigned_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.asset_type, a.manufacturer, a.model, a.serial_number, a.asset_tag,
         a.department, a.purchase_date, a.purchase_cost, a.warranty_expiry,
         a.mdm_enrolled, a.status, a.assigned_to ?? null]
      );
    }
    console.log(`✅  ${IT_ASSETS.length}`);

    // ── ST Jobs ─────────────────────────────────────────────────────────────
    console.log('\n⏳  ST jobs…');
    const ST_JOBS = [
      { id: 'j1000000-0000-0000-0000-000000000001', st_job_id: 'ST-10001', job_number: '10001', customer_name: 'James & Martha Whitfield', customer_address: '512 Oak Trail Dr, Flower Mound TX 75028', status: 'in_progress', job_type: 'service_call',  truck_id: 'b1000000-0000-0000-0000-000000000001', technician_id: 'd1000000-0000-0000-0000-000000000003', scheduled_at: new Date().toISOString() },
      { id: 'j1000000-0000-0000-0000-000000000002', st_job_id: 'ST-10002', job_number: '10002', customer_name: 'Ridgewood HOA Clubhouse',   customer_address: '200 Ridgewood Pkwy, Lewisville TX 75067', status: 'scheduled',   job_type: 'maintenance',   truck_id: 'b1000000-0000-0000-0000-000000000001', technician_id: 'd1000000-0000-0000-0000-000000000003', scheduled_at: new Date(Date.now() + 86400000).toISOString() },
      { id: 'j1000000-0000-0000-0000-000000000003', st_job_id: 'ST-10003', job_number: '10003', customer_name: 'Chen Residence',            customer_address: '3401 Creekside Ln, Denton TX 76205',    status: 'scheduled',   job_type: 'install',       truck_id: 'b1000000-0000-0000-0000-000000000002', technician_id: 'd1000000-0000-0000-0000-000000000004', scheduled_at: new Date(Date.now() + 172800000).toISOString() },
      { id: 'j1000000-0000-0000-0000-000000000004', st_job_id: 'ST-10004', job_number: '10004', customer_name: 'Patel Family Home',         customer_address: '718 Westgate Blvd, Coppell TX 75019',   status: 'in_progress', job_type: 'service_call',  truck_id: 'b1000000-0000-0000-0000-000000000004', technician_id: 'd1000000-0000-0000-0000-000000000005', scheduled_at: new Date().toISOString() },
      { id: 'j1000000-0000-0000-0000-000000000005', st_job_id: 'ST-10005', job_number: '10005', customer_name: 'Sunrise Baptist Church',    customer_address: '4800 FM 407, Highland Village TX 75077',status: 'scheduled',   job_type: 'maintenance',   truck_id: 'b1000000-0000-0000-0000-000000000004', technician_id: 'd1000000-0000-0000-0000-000000000005', scheduled_at: new Date(Date.now() + 86400000).toISOString() },
      { id: 'j1000000-0000-0000-0000-000000000006', st_job_id: 'ST-10006', job_number: '10006', customer_name: 'Nguyen Commercial Plaza',   customer_address: '101 Commerce Dr, Argyle TX 76226',      status: 'scheduled',   job_type: 'install',       truck_id: 'b1000000-0000-0000-0000-000000000005', technician_id: 'd1000000-0000-0000-0000-000000000006', scheduled_at: new Date(Date.now() + 172800000).toISOString() },
    ];
    for (const j of ST_JOBS) {
      await client.query(
        `INSERT INTO st_jobs (id, st_job_id, job_number, customer_name, customer_address,
                              status, job_type, truck_id, technician_id, scheduled_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [j.id, j.st_job_id, j.job_number, j.customer_name, j.customer_address,
         j.status, j.job_type, j.truck_id, j.technician_id, j.scheduled_at]
      );
    }
    console.log(`✅  ${ST_JOBS.length}`);

    console.log('\n🎉  Seed complete!\n');
    console.log('Login credentials:');
    console.log('  admin@christmasair.com  / admin123  (admin)');
    console.log('  mgr@christmasair.com    / pass123   (manager)');
    console.log('  carlos@christmasair.com / pass123   (tech — Truck P-01)');
    console.log('  sam@christmasair.com    / pass123   (tech — Truck H-01)\n');

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
