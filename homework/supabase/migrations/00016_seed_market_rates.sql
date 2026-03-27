-- =============================================
-- Migration 00016: Seed DFW Market Rates
-- =============================================
-- DFW market pricing benchmarks for all 100 catalog services.
-- Based on HomeAdvisor/Angi/Thumbtack DFW price ranges (2025-2026).
-- low = 25th percentile, median = 50th, high = 75th (all in cents).
-- labor_pct and materials_pct are typical breakdowns per service type.

-- Helper: insert by service slug lookup
-- THE LOT — Lawn & Turf
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 3500, 4500, 6500, 85.00, 5.00 FROM catalog_services WHERE slug = 'weekly-lawn-mowing'
UNION ALL SELECT id, 'dfw', 25000, 40000, 60000, 40.00, 45.00 FROM catalog_services WHERE slug = 'lawn-fertilization-program'
UNION ALL SELECT id, 'dfw', 7500, 12000, 18000, 75.00, 10.00 FROM catalog_services WHERE slug = 'core-aeration'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 50.00, 35.00 FROM catalog_services WHERE slug = 'overseeding'
UNION ALL SELECT id, 'dfw', 100000, 175000, 300000, 45.00, 45.00 FROM catalog_services WHERE slug = 'sod-installation'
UNION ALL SELECT id, 'dfw', 7500, 12500, 17500, 80.00, 10.00 FROM catalog_services WHERE slug = 'sprinkler-system-winterization'
UNION ALL SELECT id, 'dfw', 10000, 20000, 35000, 60.00, 30.00 FROM catalog_services WHERE slug = 'sprinkler-repair'
UNION ALL SELECT id, 'dfw', 250000, 400000, 600000, 50.00, 40.00 FROM catalog_services WHERE slug = 'sprinkler-system-installation'
UNION ALL SELECT id, 'dfw', 5000, 7500, 12000, 50.00, 35.00 FROM catalog_services WHERE slug = 'weed-control-treatment';

-- THE LOT — Landscaping & Hardscaping
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 30000, 50000, 80000, 45.00, 40.00 FROM catalog_services WHERE slug = 'flower-bed-installation'
UNION ALL SELECT id, 'dfw', 10000, 17500, 25000, 80.00, 10.00 FROM catalog_services WHERE slug = 'flower-bed-maintenance'
UNION ALL SELECT id, 'dfw', 25000, 50000, 100000, 75.00, 5.00 FROM catalog_services WHERE slug = 'tree-trimming'
UNION ALL SELECT id, 'dfw', 50000, 100000, 200000, 70.00, 5.00 FROM catalog_services WHERE slug = 'tree-removal'
UNION ALL SELECT id, 'dfw', 200000, 350000, 600000, 45.00, 40.00 FROM catalog_services WHERE slug = 'patio-installation'
UNION ALL SELECT id, 'dfw', 150000, 300000, 500000, 55.00, 35.00 FROM catalog_services WHERE slug = 'french-drain-installation'
UNION ALL SELECT id, 'dfw', 200000, 400000, 700000, 45.00, 40.00 FROM catalog_services WHERE slug = 'retaining-wall'
UNION ALL SELECT id, 'dfw', 150000, 300000, 500000, 40.00, 45.00 FROM catalog_services WHERE slug = 'outdoor-lighting-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 60.00, 30.00 FROM catalog_services WHERE slug = 'mulch-installation';

-- THE LOT — Fencing
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 200000, 350000, 550000, 40.00, 50.00 FROM catalog_services WHERE slug = 'wood-fence-installation'
UNION ALL SELECT id, 'dfw', 20000, 40000, 75000, 65.00, 25.00 FROM catalog_services WHERE slug = 'wood-fence-repair'
UNION ALL SELECT id, 'dfw', 300000, 500000, 800000, 35.00, 55.00 FROM catalog_services WHERE slug = 'iron-metal-fence-installation'
UNION ALL SELECT id, 'dfw', 15000, 30000, 50000, 60.00, 30.00 FROM catalog_services WHERE slug = 'gate-repair-replacement';

-- THE LOT — Driveway & Walkways
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 10000, 17500, 30000, 60.00, 30.00 FROM catalog_services WHERE slug = 'driveway-sealing'
UNION ALL SELECT id, 'dfw', 300000, 500000, 800000, 40.00, 50.00 FROM catalog_services WHERE slug = 'driveway-replacement'
UNION ALL SELECT id, 'dfw', 50000, 100000, 175000, 55.00, 35.00 FROM catalog_services WHERE slug = 'concrete-leveling';

-- THE LOT — Pool & Outdoor Living
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 10000, 15000, 22500, 70.00, 20.00 FROM catalog_services WHERE slug = 'pool-cleaning-monthly'
UNION ALL SELECT id, 'dfw', 15000, 35000, 60000, 60.00, 30.00 FROM catalog_services WHERE slug = 'pool-equipment-repair'
UNION ALL SELECT id, 'dfw', 400000, 700000, 1200000, 40.00, 50.00 FROM catalog_services WHERE slug = 'pool-resurfacing'
UNION ALL SELECT id, 'dfw', 300000, 500000, 800000, 45.00, 45.00 FROM catalog_services WHERE slug = 'pergola-installation'
UNION ALL SELECT id, 'dfw', 500000, 1000000, 2000000, 35.00, 50.00 FROM catalog_services WHERE slug = 'outdoor-kitchen-installation';

-- THE EXTERIOR — Roofing
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 600000, 1000000, 1500000, 40.00, 45.00 FROM catalog_services WHERE slug = 'roof-replacement'
UNION ALL SELECT id, 'dfw', 30000, 60000, 120000, 65.00, 25.00 FROM catalog_services WHERE slug = 'roof-leak-repair'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 85.00, 5.00 FROM catalog_services WHERE slug = 'roof-inspection'
UNION ALL SELECT id, 'dfw', 200000, 400000, 700000, 45.00, 45.00 FROM catalog_services WHERE slug = 'flat-roof-coating';

-- THE EXTERIOR — Siding & Exterior Walls
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 500000, 900000, 1400000, 40.00, 50.00 FROM catalog_services WHERE slug = 'siding-installation'
UNION ALL SELECT id, 'dfw', 30000, 60000, 100000, 60.00, 30.00 FROM catalog_services WHERE slug = 'brick-stone-repair'
UNION ALL SELECT id, 'dfw', 200000, 400000, 650000, 65.00, 25.00 FROM catalog_services WHERE slug = 'exterior-painting'
UNION ALL SELECT id, 'dfw', 15000, 27500, 45000, 70.00, 15.00 FROM catalog_services WHERE slug = 'power-washing';

-- THE EXTERIOR — Windows & Doors
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 40000, 65000, 100000, 30.00, 60.00 FROM catalog_services WHERE slug = 'window-replacement'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 55.00, 35.00 FROM catalog_services WHERE slug = 'window-tinting'
UNION ALL SELECT id, 'dfw', 80000, 150000, 250000, 25.00, 65.00 FROM catalog_services WHERE slug = 'front-door-replacement'
UNION ALL SELECT id, 'dfw', 100000, 175000, 275000, 30.00, 60.00 FROM catalog_services WHERE slug = 'sliding-door-installation'
UNION ALL SELECT id, 'dfw', 80000, 125000, 200000, 25.00, 65.00 FROM catalog_services WHERE slug = 'garage-door-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 45000, 70.00, 20.00 FROM catalog_services WHERE slug = 'garage-door-repair'
UNION ALL SELECT id, 'dfw', 25000, 40000, 60000, 40.00, 50.00 FROM catalog_services WHERE slug = 'garage-door-opener-installation'
UNION ALL SELECT id, 'dfw', 25000, 45000, 70000, 30.00, 60.00 FROM catalog_services WHERE slug = 'storm-door-installation';

-- THE EXTERIOR — Foundation
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 25000, 45000, 65000, 85.00, 5.00 FROM catalog_services WHERE slug = 'foundation-inspection'
UNION ALL SELECT id, 'dfw', 400000, 700000, 1200000, 50.00, 40.00 FROM catalog_services WHERE slug = 'foundation-pier-repair'
UNION ALL SELECT id, 'dfw', 200000, 400000, 650000, 55.00, 35.00 FROM catalog_services WHERE slug = 'foundation-drainage-correction';

-- THE EXTERIOR — Gutters
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 10000, 17500, 27500, 90.00, 2.00 FROM catalog_services WHERE slug = 'gutter-cleaning'
UNION ALL SELECT id, 'dfw', 80000, 125000, 200000, 40.00, 50.00 FROM catalog_services WHERE slug = 'gutter-installation'
UNION ALL SELECT id, 'dfw', 100000, 175000, 275000, 35.00, 55.00 FROM catalog_services WHERE slug = 'gutter-guard-installation';

-- THE EXTERIOR — Insulation & Weatherproofing
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 100000, 175000, 275000, 40.00, 50.00 FROM catalog_services WHERE slug = 'attic-insulation'
UNION ALL SELECT id, 'dfw', 75000, 125000, 200000, 45.00, 45.00 FROM catalog_services WHERE slug = 'radiant-barrier-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 70.00, 20.00 FROM catalog_services WHERE slug = 'weather-stripping-caulking';

-- THE INTERIOR — HVAC
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 500000, 800000, 1200000, 30.00, 55.00 FROM catalog_services WHERE slug = 'ac-system-replacement'
UNION ALL SELECT id, 'dfw', 250000, 450000, 700000, 35.00, 50.00 FROM catalog_services WHERE slug = 'furnace-replacement'
UNION ALL SELECT id, 'dfw', 400000, 700000, 1000000, 30.00, 55.00 FROM catalog_services WHERE slug = 'heat-pump-installation'
UNION ALL SELECT id, 'dfw', 200000, 400000, 600000, 35.00, 50.00 FROM catalog_services WHERE slug = 'mini-split-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 50.00, 40.00 FROM catalog_services WHERE slug = 'smart-thermostat-installation'
UNION ALL SELECT id, 'dfw', 7500, 12500, 17500, 90.00, 5.00 FROM catalog_services WHERE slug = 'ac-tune-up'
UNION ALL SELECT id, 'dfw', 7500, 12500, 17500, 90.00, 5.00 FROM catalog_services WHERE slug = 'heating-tune-up'
UNION ALL SELECT id, 'dfw', 15000, 30000, 60000, 70.00, 20.00 FROM catalog_services WHERE slug = 'ac-repair'
UNION ALL SELECT id, 'dfw', 25000, 40000, 60000, 80.00, 5.00 FROM catalog_services WHERE slug = 'duct-cleaning'
UNION ALL SELECT id, 'dfw', 100000, 175000, 275000, 65.00, 25.00 FROM catalog_services WHERE slug = 'duct-sealing'
UNION ALL SELECT id, 'dfw', 50000, 80000, 125000, 35.00, 55.00 FROM catalog_services WHERE slug = 'air-purifier-installation'
UNION ALL SELECT id, 'dfw', 40000, 65000, 100000, 35.00, 55.00 FROM catalog_services WHERE slug = 'uv-light-installation';

-- THE INTERIOR — Plumbing
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 80000, 125000, 200000, 40.00, 50.00 FROM catalog_services WHERE slug = 'tank-water-heater-replacement'
UNION ALL SELECT id, 'dfw', 150000, 275000, 400000, 35.00, 55.00 FROM catalog_services WHERE slug = 'tankless-water-heater-installation'
UNION ALL SELECT id, 'dfw', 10000, 20000, 35000, 85.00, 5.00 FROM catalog_services WHERE slug = 'drain-cleaning'
UNION ALL SELECT id, 'dfw', 15000, 30000, 50000, 80.00, 10.00 FROM catalog_services WHERE slug = 'sewer-line-camera-inspection'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 45.00, 45.00 FROM catalog_services WHERE slug = 'faucet-replacement'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 45.00, 45.00 FROM catalog_services WHERE slug = 'toilet-replacement'
UNION ALL SELECT id, 'dfw', 15000, 25000, 35000, 50.00, 40.00 FROM catalog_services WHERE slug = 'garbage-disposal-installation'
UNION ALL SELECT id, 'dfw', 100000, 175000, 275000, 35.00, 55.00 FROM catalog_services WHERE slug = 'water-softener-installation'
UNION ALL SELECT id, 'dfw', 400000, 700000, 1200000, 55.00, 35.00 FROM catalog_services WHERE slug = 'whole-house-repipe'
UNION ALL SELECT id, 'dfw', 200000, 400000, 700000, 65.00, 25.00 FROM catalog_services WHERE slug = 'slab-leak-repair'
UNION ALL SELECT id, 'dfw', 30000, 50000, 80000, 55.00, 35.00 FROM catalog_services WHERE slug = 'gas-line-installation'
UNION ALL SELECT id, 'dfw', 50000, 85000, 125000, 45.00, 45.00 FROM catalog_services WHERE slug = 'sump-pump-installation'
UNION ALL SELECT id, 'dfw', 75000, 125000, 200000, 35.00, 55.00 FROM catalog_services WHERE slug = 'water-filtration-system';

-- THE INTERIOR — Electrical
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 150000, 250000, 400000, 45.00, 45.00 FROM catalog_services WHERE slug = 'electrical-panel-upgrade'
UNION ALL SELECT id, 'dfw', 10000, 17500, 27500, 60.00, 30.00 FROM catalog_services WHERE slug = 'outlet-switch-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 45.00, 45.00 FROM catalog_services WHERE slug = 'ceiling-fan-installation'
UNION ALL SELECT id, 'dfw', 10000, 17500, 27500, 50.00, 40.00 FROM catalog_services WHERE slug = 'recessed-lighting-installation'
UNION ALL SELECT id, 'dfw', 15000, 25000, 40000, 40.00, 50.00 FROM catalog_services WHERE slug = 'whole-house-surge-protector'
UNION ALL SELECT id, 'dfw', 50000, 85000, 125000, 40.00, 50.00 FROM catalog_services WHERE slug = 'ev-charger-installation'
UNION ALL SELECT id, 'dfw', 600000, 1000000, 1500000, 30.00, 60.00 FROM catalog_services WHERE slug = 'whole-house-generator-installation';

-- THE INTERIOR — Interior Finishes
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 150000, 300000, 500000, 65.00, 25.00 FROM catalog_services WHERE slug = 'interior-painting'
UNION ALL SELECT id, 'dfw', 200000, 400000, 650000, 70.00, 20.00 FROM catalog_services WHERE slug = 'cabinet-refinishing'
UNION ALL SELECT id, 'dfw', 300000, 500000, 800000, 40.00, 50.00 FROM catalog_services WHERE slug = 'hardwood-floor-installation'
UNION ALL SELECT id, 'dfw', 150000, 275000, 425000, 40.00, 50.00 FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'
UNION ALL SELECT id, 'dfw', 200000, 400000, 650000, 45.00, 45.00 FROM catalog_services WHERE slug = 'tile-floor-installation'
UNION ALL SELECT id, 'dfw', 100000, 200000, 350000, 40.00, 50.00 FROM catalog_services WHERE slug = 'carpet-installation'
UNION ALL SELECT id, 'dfw', 200000, 400000, 700000, 30.00, 60.00 FROM catalog_services WHERE slug = 'countertop-replacement'
UNION ALL SELECT id, 'dfw', 25000, 45000, 70000, 80.00, 10.00 FROM catalog_services WHERE slug = 'tub-shower-reglazing'
UNION ALL SELECT id, 'dfw', 75000, 150000, 250000, 45.00, 45.00 FROM catalog_services WHERE slug = 'backsplash-installation';

-- THE INTERIOR — Appliances
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 10000, 17500, 27500, 85.00, 5.00 FROM catalog_services WHERE slug = 'appliance-installation'
UNION ALL SELECT id, 'dfw', 10000, 20000, 35000, 75.00, 15.00 FROM catalog_services WHERE slug = 'appliance-repair';

-- THE INTERIOR — Pest Control
INSERT INTO catalog_service_market_rates (service_id, market, low_price, median_price, high_price, labor_pct, materials_pct)
SELECT id, 'dfw', 10000, 15000, 22500, 60.00, 30.00 FROM catalog_services WHERE slug = 'general-pest-control-quarterly'
UNION ALL SELECT id, 'dfw', 50000, 100000, 175000, 55.00, 35.00 FROM catalog_services WHERE slug = 'termite-inspection-treatment';
