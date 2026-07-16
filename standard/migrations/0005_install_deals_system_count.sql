-- True system count (complete condenser+furnace+coil / heat-pump+air-handler /
-- packaged sets). equipment_unit_count is repurposed to mean Components (real unit
-- pieces, excluding accessories). See lib/equipment.ts.
alter table install_deals add column if not exists system_count int default 0;
