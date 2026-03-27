/**
 * Demo HVAC System Data
 * Mock data for testing the SystemCard and HomeFitHeader components
 */

import type { HVACSystemCard, SystemComponent, HomeFitContext } from '@/types/hvac-shopping'

// Demo components for a typical aging system
const DOWNSTAIRS_COMPONENTS: SystemComponent[] = [
  {
    id: 'therm-1',
    type: 'thermostat',
    name: 'Thermostat',
    brand: 'Nest',
    warrantyStatus: 'active',
  },
  {
    id: 'cond-1',
    type: 'condenser',
    name: 'Outdoor Condenser',
    brand: 'American Standard',
    age: 19,
    warrantyStatus: 'expired',
  },
  {
    id: 'coil-1',
    type: 'coil',
    name: 'Evaporator Coil',
    brand: 'American Standard',
    age: 19,
    warrantyStatus: 'expired',
  },
  {
    id: 'furn-1',
    type: 'furnace',
    name: 'Furnace',
    brand: 'American Standard',
    age: 19,
    warrantyStatus: 'expired',
  },
]

// Demo system matching the Lovable screenshot
export const DEMO_HVAC_SYSTEM_DOWNSTAIRS: HVACSystemCard = {
  id: 'system-downstairs',
  name: 'Downstairs',
  systemType: '4-ton straight AC system with gas furnace',
  tonnage: 4,
  tags: ['HVAC', 'attic', 'Gas Heat'],
  healthGrade: 'F',
  healthMessage: 'Well past useful life - replacement recommended',
  estimatedAge: 19,
  components: DOWNSTAIRS_COMPONENTS,
}

// Demo upstairs system (newer, better condition)
const UPSTAIRS_COMPONENTS: SystemComponent[] = [
  {
    id: 'therm-2',
    type: 'thermostat',
    name: 'Thermostat',
    brand: 'Honeywell',
    warrantyStatus: 'active',
  },
  {
    id: 'cond-2',
    type: 'condenser',
    name: 'Outdoor Condenser',
    brand: 'Carrier',
    model: 'Performance 17',
    age: 8,
    warrantyStatus: 'active',
    warrantyExpires: '2027-06-15',
  },
  {
    id: 'coil-2',
    type: 'coil',
    name: 'Evaporator Coil',
    brand: 'Carrier',
    age: 8,
    warrantyStatus: 'active',
    warrantyExpires: '2027-06-15',
  },
  {
    id: 'furn-2',
    type: 'furnace',
    name: 'Furnace',
    brand: 'Carrier',
    age: 8,
    warrantyStatus: 'active',
    warrantyExpires: '2027-06-15',
  },
]

export const DEMO_HVAC_SYSTEM_UPSTAIRS: HVACSystemCard = {
  id: 'system-upstairs',
  name: 'Upstairs',
  systemType: '3-ton straight AC system with gas furnace',
  tonnage: 3,
  tags: ['HVAC', 'closet', 'Gas Heat'],
  healthGrade: 'B',
  healthMessage: 'System is in good condition with regular maintenance',
  estimatedAge: 8,
  components: UPSTAIRS_COMPONENTS,
}

// All demo systems
export const DEMO_HVAC_SYSTEMS: HVACSystemCard[] = [
  DEMO_HVAC_SYSTEM_DOWNSTAIRS,
  DEMO_HVAC_SYSTEM_UPSTAIRS,
]

// Helper to get a system by ID
export function getDemoSystem(id: string): HVACSystemCard | undefined {
  return DEMO_HVAC_SYSTEMS.find(s => s.id === id)
}

// Helper to get the primary (worst condition) system
export function getPrimaryDemoSystem(): HVACSystemCard {
  // Return the system with the worst health grade
  const gradeOrder = ['F', 'D', 'C', 'B', 'A'] as const
  return DEMO_HVAC_SYSTEMS.reduce((worst, current) => {
    const worstIndex = gradeOrder.indexOf(worst.healthGrade)
    const currentIndex = gradeOrder.indexOf(current.healthGrade)
    return currentIndex < worstIndex ? current : worst
  })
}

// =============================================================================
// Demo HomeFit Context
// =============================================================================

// Standard whole-home replacement context
export const DEMO_HOMEFIT_CONTEXT: HomeFitContext = {
  scope: 'whole_home',
  tonnage: 4,
  systemType: 'AC + Gas Furnace',
  heatSource: 'gas',
  tierPreference: 'mid-range',
}

// Economy-focused context
export const DEMO_HOMEFIT_ECONOMY: HomeFitContext = {
  scope: 'downstairs',
  tonnage: 3,
  systemType: 'AC + Gas Furnace',
  heatSource: 'gas',
  tierPreference: 'economy',
}

// Premium heat pump context
export const DEMO_HOMEFIT_PREMIUM: HomeFitContext = {
  scope: 'whole_home',
  tonnage: 5,
  systemType: 'Heat Pump',
  heatSource: 'heat_pump',
  tierPreference: 'premium',
}
