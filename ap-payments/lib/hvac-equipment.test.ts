import { describe, it, expect } from 'vitest';
import { classifyEquipment, countComponents, countSystems } from './hvac-equipment';

describe('classifyEquipment', () => {
  it('classifies real American Standard SKUs', () => {
    expect(classifyEquipment('5A7A4036A')).toBe('condenser');   // AC
    expect(classifyEquipment('5A6H4036A')).toBe('condenser');   // heat pump
    expect(classifyEquipment('5A7V8X24A')).toBe('condenser');   // variable AC
    expect(classifyEquipment('5TXCA002AS')).toBe('coil');
    expect(classifyEquipment('5TEM4D04AC3')).toBe('air_handler');
    expect(classifyEquipment('S8X1A040M3PS')).toBe('furnace');
    expect(classifyEquipment('S8V2A040M3PCA')).toBe('furnace');
  });
  it('treats accessories as accessory (excluded)', () => {
    expect(classifyEquipment('BAYHTR1517BRKA', 'BAYHTR heat strip')).toBe('accessory');
    expect(classifyEquipment('ALINK360A2VVU', 'LINK Communicating Control')).toBe('accessory');
  });
});

describe('countComponents / countSystems', () => {
  const full = [
    { sku: '5A7A4036A' }, { sku: '5A7A4042A' }, { sku: '5A7A4024A' },
    { sku: '5TXCB004AS' }, { sku: '5TXCA002AS' }, { sku: '5TXCB006AS' },
    { sku: 'S8X1A040M3PS' }, { sku: 'S8X1B060M4PS' }, { sku: 'S8X1B080M4PS' },
  ];
  const partial = [{ sku: '5A7A6060A' }, { sku: '5TXCC009AS' }];
  const heatPump = [{ sku: '5A6H4036A' }, { sku: '5TEM4D04AC3' }, { sku: 'BAYHTR1517BRKA', name: 'heat strip' }];

  it('full: 9 components, 3 systems', () => {
    expect(countComponents(full)).toBe(9);
    expect(countSystems(full)).toBe(3);
  });
  it('partial: 2 components, 1 system', () => {
    expect(countComponents(partial)).toBe(2);
    expect(countSystems(partial)).toBe(1);
  });
  it('heat pump + air handler + heat strip: 2 components (strip excluded), 1 system', () => {
    expect(countComponents(heatPump)).toBe(2);
    expect(countSystems(heatPump)).toBe(1);
  });
});
