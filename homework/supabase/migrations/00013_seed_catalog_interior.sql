-- =============================================
-- Migration 00013: Seed Catalog - The Interior
-- =============================================
-- Department 3: THE INTERIOR
-- 6 categories, 45 services
-- HVAC, Plumbing, Electrical, Interior Finishes, Appliances, Pest Control

-- =============================================
-- DEPARTMENT
-- =============================================

INSERT INTO catalog_departments (name, slug, description, icon, display_order)
VALUES ('The Interior', 'the-interior', 'HVAC, plumbing, electrical, finishes, appliances, and pest control', '🏗️', 3);

-- =============================================
-- CATEGORIES
-- =============================================

INSERT INTO catalog_categories (department_id, name, slug, description, icon, display_order) VALUES
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'HVAC', 'hvac', 'Heating, ventilation, and air conditioning installation, repair, and maintenance', '❄️', 1),
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'Plumbing', 'plumbing', 'Water heaters, drains, pipes, fixtures, and water treatment systems', '🔧', 2),
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'Electrical', 'electrical', 'Panel upgrades, wiring, lighting, and power installations', '⚡', 3),
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'Interior Finishes', 'interior-finishes', 'Painting, flooring, countertops, and surface refinishing', '🎨', 4),
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'Appliances', 'appliances', 'Appliance installation and repair services', '🍳', 5),
((SELECT id FROM catalog_departments WHERE slug = 'the-interior'), 'Pest Control', 'pest-control', 'General pest management and termite treatment', '🐜', 6);

-- =============================================
-- SERVICES: HVAC (12 services)
-- =============================================

-- 1. AC System Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'AC System Replacement',
  'ac-system-replacement',
  'Full air conditioning system replacement with new outdoor condenser and indoor evaporator coil',
  'Complete removal of your existing central air conditioning system and installation of a new, properly sized replacement. Includes new outdoor condenser unit, indoor evaporator coil, refrigerant line set, and thermostat wiring verification. All work performed by licensed HVAC technicians and includes manufacturer warranty registration.',
  ARRAY['Removal and disposal of existing AC system', 'New outdoor condenser unit installation', 'New indoor evaporator coil installation', 'Refrigerant charge and leak test', 'System startup and performance verification'],
  ARRAY['Ductwork modification or replacement', 'Electrical panel upgrades', 'Thermostat replacement (available as add-on)'],
  3, 'photo_estimate', 3,
  '{"has_central_hvac": true}',
  360, 600,
  '❄️', 1, TRUE, TRUE
);

-- 2. Furnace Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Furnace Replacement',
  'furnace-replacement',
  'Complete gas or electric furnace replacement with new high-efficiency unit',
  'Full removal and replacement of your existing furnace with a new high-efficiency unit. Includes proper sizing calculation, gas line connection (for gas furnaces), venting inspection, and full system commissioning. All work meets current building codes and includes manufacturer warranty registration.',
  ARRAY['Removal and disposal of existing furnace', 'New furnace installation and connection', 'Gas line connection and leak test (gas units)', 'Venting inspection and connection', 'System commissioning and safety check'],
  ARRAY['Ductwork modification or replacement', 'Gas line extension or new run', 'Electrical panel upgrades'],
  3, 'photo_estimate', 3,
  '{"has_central_hvac": true}',
  240, 480,
  '🔥', 2, TRUE, FALSE
);

-- 3. Heat Pump Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Heat Pump Installation',
  'heat-pump-installation',
  'Energy-efficient heat pump system for year-round heating and cooling',
  'Installation of a new heat pump system that provides both heating and cooling from a single unit. Ideal for DFW''s mild winters and hot summers. Includes outdoor unit, indoor air handler or connection to existing ductwork, refrigerant line set, and complete system commissioning.',
  ARRAY['Outdoor heat pump unit installation', 'Indoor air handler or coil connection', 'Refrigerant line set and charge', 'Thermostat wiring and programming', 'System performance verification'],
  ARRAY['Ductwork installation or modification', 'Electrical panel upgrade if needed', 'Removal of existing gas furnace (quoted separately)'],
  3, 'configurator', 2,
  '{}',
  360, 600,
  '♻️', 3, TRUE, FALSE
);

-- 4. Mini-Split Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Mini-Split Installation',
  'mini-split-installation',
  'Ductless mini-split system for zoned heating and cooling',
  'Installation of a ductless mini-split system for targeted heating and cooling. Perfect for room additions, garages, or areas without existing ductwork. Includes outdoor compressor, indoor wall-mounted air handler(s), refrigerant line set, and electrical connection.',
  ARRAY['Outdoor compressor unit installation', 'Indoor wall-mounted unit(s) installation', 'Refrigerant line set with line hide cover', 'Dedicated electrical circuit (if within 15 ft of panel)', 'System commissioning and remote programming'],
  ARRAY['Electrical panel upgrade', 'Structural wall modifications', 'Multi-zone systems beyond selected configuration'],
  4, 'configurator', 2,
  '{}',
  180, 360,
  '🌡️', 4, TRUE, FALSE
);

-- 5. Smart Thermostat Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Smart Thermostat Installation',
  'smart-thermostat-installation',
  'Professional installation of a Wi-Fi enabled smart thermostat',
  'Professional removal of your existing thermostat and installation of a new smart thermostat with Wi-Fi connectivity. Includes wiring verification, C-wire installation if needed, Wi-Fi setup, and walkthrough of app features and scheduling.',
  ARRAY['Removal of existing thermostat', 'New smart thermostat mounting and wiring', 'C-wire installation if needed', 'Wi-Fi connection and app setup', 'Programming walkthrough and scheduling setup'],
  ARRAY['Thermostat device cost (customer-supplied or add-on)', 'HVAC system repairs', 'Additional wiring runs beyond thermostat location'],
  5, 'instant_price', 1,
  '{"has_central_hvac": true}',
  30, 60,
  '📱', 5, TRUE, TRUE
);

-- 6. AC Tune-Up
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'AC Tune-Up',
  'ac-tune-up',
  'Comprehensive air conditioning maintenance and performance check',
  'Complete preventive maintenance service for your central air conditioning system. A licensed technician inspects, cleans, and optimizes your AC to ensure peak performance and efficiency before the DFW summer heat arrives.',
  ARRAY['Condenser coil cleaning', 'Refrigerant level check and top-off (up to 1 lb)', 'Electrical connection inspection and tightening', 'Thermostat calibration check', 'Air filter inspection with replacement recommendation'],
  ARRAY['Refrigerant recharge beyond 1 lb', 'Parts replacement or repairs', 'Duct cleaning (available as separate service)'],
  5, 'instant_price', 1,
  '{"has_central_hvac": true}',
  45, 90,
  '🔧', 6, TRUE, TRUE
);

-- 7. Heating Tune-Up
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Heating Tune-Up',
  'heating-tune-up',
  'Comprehensive furnace or heat pump heating maintenance',
  'Complete preventive maintenance for your heating system. Includes safety inspection, combustion analysis (gas furnaces), heat exchanger inspection, and performance optimization to ensure reliable and efficient heating throughout DFW''s winter season.',
  ARRAY['Burner and heat exchanger inspection (gas furnaces)', 'Combustion analysis and CO safety check', 'Blower motor and electrical inspection', 'Thermostat heating mode calibration', 'Air filter inspection with replacement recommendation'],
  ARRAY['Parts replacement or repairs', 'Duct cleaning (available as separate service)', 'Gas line repairs'],
  5, 'instant_price', 1,
  '{"has_central_hvac": true}',
  45, 90,
  '🔥', 7, TRUE, FALSE
);

-- 8. AC Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'AC Repair',
  'ac-repair',
  'Diagnostic and repair service for air conditioning systems',
  'On-site diagnostic and repair of your central air conditioning system. A licensed technician will diagnose the issue, provide upfront pricing for the repair, and complete the work on the same visit when possible.',
  ARRAY['Complete system diagnostic', 'Upfront repair pricing before work begins', 'Repair of diagnosed issue', 'System performance test after repair'],
  ARRAY['Full system replacement', 'Ductwork repairs or replacement', 'Refrigerant leak repairs requiring brazing (quoted separately)'],
  2, 'onsite_estimate', 4,
  '{"has_central_hvac": true}',
  60, 240,
  '🛠️', 8, TRUE, FALSE
);

-- 9. Duct Cleaning
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Duct Cleaning',
  'duct-cleaning',
  'Professional air duct cleaning for improved indoor air quality',
  'Complete cleaning of your home''s air duct system using professional-grade equipment. Removes dust, allergens, and debris buildup to improve indoor air quality and HVAC efficiency. Includes all supply and return ducts accessible from existing registers.',
  ARRAY['Cleaning of all accessible supply ducts', 'Cleaning of all return air ducts', 'Main trunk line cleaning', 'Register and grille cleaning', 'Before/after photo documentation'],
  ARRAY['Dryer vent cleaning (available as add-on)', 'Duct repair or replacement', 'Mold remediation (requires specialist)'],
  5, 'instant_price', 1,
  '{"has_ductwork": true}',
  120, 240,
  '💨', 9, TRUE, FALSE
);

-- 10. Duct Sealing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Duct Sealing',
  'duct-sealing',
  'Professional duct sealing to eliminate air leaks and improve efficiency',
  'Comprehensive sealing of your ductwork to eliminate air leaks that waste energy and reduce comfort. Uses professional-grade mastic sealant and foil tape on all accessible joints, connections, and seams. Can reduce energy bills by up to 20% in DFW homes.',
  ARRAY['Duct leakage assessment', 'Sealing of all accessible duct joints and connections', 'Mastic sealant and foil tape application', 'Boot-to-drywall sealing at registers', 'Post-sealing airflow verification'],
  ARRAY['Ductwork replacement or rerouting', 'Duct insulation (available as add-on)', 'Access creation through walls or ceilings'],
  3, 'configurator', 2,
  '{"has_ductwork": true}',
  120, 360,
  '🔒', 10, TRUE, FALSE
);

-- 11. Air Purifier Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'Air Purifier Installation',
  'air-purifier-installation',
  'Whole-home air purification system integrated with your HVAC',
  'Installation of a whole-home air purification system that integrates directly into your existing HVAC ductwork. Removes allergens, bacteria, viruses, and odors from your indoor air. Ideal for DFW allergy sufferers and homes with pets.',
  ARRAY['Air purifier unit installation in ductwork', 'Electrical connection to HVAC system', 'System integration and activation', 'Filter and maintenance walkthrough'],
  ARRAY['Air purifier unit cost (customer-supplied or add-on)', 'Ductwork modification beyond standard cut-in', 'HVAC system repairs'],
  4, 'configurator', 2,
  '{}',
  60, 120,
  '🌿', 11, TRUE, FALSE
);

-- 12. UV Light Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'hvac'),
  'UV Light Installation',
  'uv-light-installation',
  'Germicidal UV light installed in your HVAC system to kill mold and bacteria',
  'Installation of a germicidal UV-C light inside your HVAC system, typically near the evaporator coil. Kills mold, bacteria, and viruses as air circulates through the system. Highly effective for DFW homes dealing with humidity-related mold on the coil.',
  ARRAY['UV light unit mounting inside air handler', 'Electrical connection and wiring', 'Bulb alignment for optimal coverage', 'System test and activation'],
  ARRAY['UV light unit cost (customer-supplied or add-on)', 'Evaporator coil cleaning (available as separate service)', 'HVAC system repairs'],
  5, 'instant_price', 1,
  '{"has_central_hvac": true}',
  30, 60,
  '🔆', 12, TRUE, FALSE
);

-- =============================================
-- SERVICES: PLUMBING (13 services)
-- =============================================

-- 13. Tank Water Heater Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Tank Water Heater Replacement',
  'tank-water-heater-replacement',
  'Standard tank water heater replacement with same-day installation',
  'Complete removal of your existing tank water heater and installation of a new unit in the same location. Includes all water and gas/electrical connections, pressure relief valve, expansion tank (where required by code), and disposal of the old unit.',
  ARRAY['Removal and disposal of existing water heater', 'New tank water heater installation', 'Water supply and gas/electrical connections', 'Expansion tank installation (code requirement)', 'System test and temperature calibration'],
  ARRAY['Relocation of water heater to new area', 'Gas line extension or new run', 'Electrical panel upgrade for electric units'],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '🚿', 1, TRUE, TRUE
);

-- 14. Tankless Water Heater Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Tankless Water Heater Installation',
  'tankless-water-heater-installation',
  'On-demand tankless water heater for endless hot water',
  'Installation of a new tankless (on-demand) water heater. Provides unlimited hot water and saves space compared to traditional tank units. Includes gas line sizing verification, venting installation, and water connections. Ideal upgrade for DFW homes looking to save energy and space.',
  ARRAY['Tankless unit mounting and installation', 'Gas line connection and sizing verification', 'Venting installation (direct vent)', 'Water supply connections', 'System activation and temperature programming'],
  ARRAY['Gas line upsizing (if required, quoted separately)', 'Electrical work for condensate pump', 'Removal of existing tank unit if in different location'],
  4, 'configurator', 2,
  '{}',
  180, 360,
  '♨️', 2, TRUE, FALSE
);

-- 15. Drain Cleaning
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Drain Cleaning',
  'drain-cleaning',
  'Professional drain clearing for clogged sinks, tubs, and floor drains',
  'Professional drain cleaning service using a motorized cable machine to clear clogs in sinks, tubs, showers, and floor drains. Covers a single drain line up to 75 feet from the cleanout or access point. Fast, reliable service to restore proper drainage.',
  ARRAY['Motorized cable drain clearing (up to 75 ft)', 'Drain flow test after clearing', 'Basic drain condition assessment', 'Clean-up of work area'],
  ARRAY['Main sewer line clearing (available as separate service)', 'Camera inspection (available as add-on)', 'Drain line repair or replacement'],
  5, 'instant_price', 1,
  '{}',
  30, 90,
  '🪠', 3, TRUE, TRUE
);

-- 16. Sewer Line Camera Inspection
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Sewer Line Camera Inspection',
  'sewer-line-camera-inspection',
  'Video camera inspection of your sewer or drain line',
  'Professional video camera inspection of your sewer or drain line to identify blockages, cracks, root intrusion, or pipe deterioration. Provides recorded footage and a written report of findings with repair recommendations if needed.',
  ARRAY['Video camera insertion and full line inspection', 'Recorded footage provided to homeowner', 'Written condition report', 'Repair recommendations if issues found'],
  ARRAY['Drain cleaning or clearing (available as separate service)', 'Sewer line repair or replacement', 'Cleanout installation if no access point exists'],
  5, 'instant_price', 1,
  '{}',
  30, 60,
  '📹', 4, TRUE, FALSE
);

-- 17. Faucet Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Faucet Replacement',
  'faucet-replacement',
  'Professional removal and installation of a new kitchen or bathroom faucet',
  'Complete removal of your existing faucet and installation of a new one. Includes water supply line connections, leak testing, and cleanup. Covers standard kitchen or bathroom faucet installations.',
  ARRAY['Removal of existing faucet', 'New faucet installation and mounting', 'Supply line connections', 'Leak test and flow check', 'Work area cleanup'],
  ARRAY['Faucet cost (customer-supplied or add-on)', 'Sink or countertop modifications', 'Supply valve replacement (available as add-on)'],
  5, 'instant_price', 1,
  '{}',
  30, 60,
  '🚰', 5, TRUE, FALSE
);

-- 18. Toilet Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Toilet Replacement',
  'toilet-replacement',
  'Old toilet removal and new toilet installation with wax ring and supply line',
  'Complete removal of your existing toilet and installation of a new unit. Includes new wax ring, mounting bolts, supply line connection, and caulking. Handles standard floor-mount toilet installations.',
  ARRAY['Removal and disposal of existing toilet', 'New wax ring and flange inspection', 'New toilet installation and leveling', 'Supply line connection and leak test', 'Caulk base to floor'],
  ARRAY['Toilet cost (customer-supplied or add-on)', 'Flange repair or replacement (quoted separately)', 'Floor repair around toilet base'],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🚽', 6, TRUE, FALSE
);

-- 19. Garbage Disposal Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Garbage Disposal Installation',
  'garbage-disposal-installation',
  'New garbage disposal installation or replacement under your kitchen sink',
  'Installation of a new garbage disposal unit under your kitchen sink. Includes mounting assembly, drain connections, electrical connection to existing outlet or hardwire, and operational test.',
  ARRAY['Removal of existing disposal (if applicable)', 'New disposal unit mounting and installation', 'Drain and dishwasher connection', 'Electrical connection to existing circuit', 'Operational test and leak check'],
  ARRAY['Disposal unit cost (customer-supplied or add-on)', 'New electrical circuit installation', 'Plumbing modifications beyond standard hookup'],
  5, 'instant_price', 1,
  '{}',
  30, 60,
  '♻️', 7, TRUE, FALSE
);

-- 20. Water Softener Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Water Softener Installation',
  'water-softener-installation',
  'Whole-house water softener system to combat DFW hard water',
  'Installation of a whole-house water softener system to reduce hard water minerals. DFW water averages 15-20 grains per gallon of hardness, making a softener a popular upgrade. Includes bypass valve, drain connection, and system programming.',
  ARRAY['Water softener unit placement and leveling', 'Main water line connection with bypass valve', 'Drain line connection', 'System programming and initial regeneration', 'Water hardness test before and after'],
  ARRAY['Water softener unit cost (customer-supplied or add-on)', 'Electrical outlet installation', 'Drain line extension beyond 20 ft'],
  4, 'configurator', 2,
  '{}',
  120, 180,
  '💧', 8, TRUE, FALSE
);

-- 21. Whole-House Repipe
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Whole-House Repipe',
  'whole-house-repipe',
  'Complete replacement of all water supply lines throughout your home',
  'Full replacement of all water supply piping in your home, typically upgrading from galvanized steel or polybutylene to modern PEX or copper. Includes all hot and cold supply lines, manifold installation (PEX), and connection to all fixtures. Multi-day project requiring drywall access.',
  ARRAY['Replacement of all hot and cold supply lines', 'New manifold installation (PEX systems)', 'Connection to all existing fixtures', 'Pressure test and leak verification', 'Basic drywall patching at access points'],
  ARRAY['Full drywall finishing and painting', 'Fixture replacement or upgrades', 'Sewer or drain line replacement'],
  2, 'onsite_estimate', 4,
  '{}',
  960, 2880,
  '🏠', 9, TRUE, FALSE
);

-- 22. Slab Leak Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Slab Leak Repair',
  'slab-leak-repair',
  'Detection and repair of water leaks in or under your concrete slab foundation',
  'Professional detection and repair of water leaks occurring in pipes running through or under your concrete slab foundation. Common in DFW homes built on slab foundations. Repair method (spot repair, reroute, or tunnel) determined after on-site evaluation.',
  ARRAY['Electronic leak detection and locating', 'Repair of leaking pipe section', 'Concrete cutting and patching (spot repair)', 'Pressure test after repair', 'Work area cleanup'],
  ARRAY['Flooring replacement over repair area', 'Foundation repair or leveling', 'Full repipe (quoted separately if needed)'],
  2, 'onsite_estimate', 4,
  '{}',
  240, 480,
  '🔍', 10, TRUE, FALSE
);

-- 23. Gas Line Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Gas Line Installation',
  'gas-line-installation',
  'New gas line run for appliances, grills, fire pits, or pool heaters',
  'Installation of a new gas line from an existing gas supply to a new appliance location. Common DFW requests include gas lines for outdoor grills, fire pits, pool heaters, generators, and kitchen ranges. Includes pressure test and city inspection coordination.',
  ARRAY['New gas pipe run from existing supply', 'Shut-off valve installation at appliance', 'Pressure test and leak check', 'City inspection coordination', 'Appliance connection (if on-site)'],
  ARRAY['Gas meter upgrade (utility company responsibility)', 'Appliance installation (available as separate service)', 'Concrete or masonry penetration'],
  3, 'configurator', 2,
  '{"has_gas_line": true}',
  120, 240,
  '🔥', 11, TRUE, FALSE
);

-- 24. Sump Pump Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Sump Pump Installation',
  'sump-pump-installation',
  'Sump pump installation to protect your home from water damage',
  'Installation of a sump pump system to remove water that accumulates in a sump basin. Protects your home from flooding and water damage during DFW''s heavy rain events. Includes sump pit, pump, check valve, and discharge line.',
  ARRAY['Sump pit excavation or preparation', 'Sump pump and check valve installation', 'Discharge line routing to exterior', 'Electrical connection to existing outlet', 'System test with water fill'],
  ARRAY['Sump pump unit cost (customer-supplied or add-on)', 'French drain or perimeter drain installation', 'Battery backup system (available as add-on)'],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '💦', 12, TRUE, FALSE
);

-- 25. Water Filtration System
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'plumbing'),
  'Water Filtration System',
  'water-filtration-system',
  'Whole-house or under-sink water filtration for cleaner, better-tasting water',
  'Installation of a water filtration system to remove contaminants, chlorine, and sediment from your water. Options range from under-sink reverse osmosis to whole-house carbon filtration. DFW municipal water is safe but filtration improves taste and reduces scale.',
  ARRAY['Filtration unit installation and mounting', 'Water line connection with shut-off valve', 'Dedicated faucet installation (under-sink RO)', 'System flush and activation', 'Filter replacement schedule walkthrough'],
  ARRAY['Filtration unit cost (customer-supplied or add-on)', 'Additional plumbing modifications', 'Well water treatment systems'],
  4, 'configurator', 2,
  '{}',
  60, 120,
  '🥤', 13, TRUE, FALSE
);

-- =============================================
-- SERVICES: ELECTRICAL (7 services)
-- =============================================

-- 26. Electrical Panel Upgrade
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Electrical Panel Upgrade',
  'electrical-panel-upgrade',
  'Main electrical panel upgrade for more capacity and modern safety features',
  'Upgrade of your home''s main electrical panel to increase capacity and add modern safety features like arc-fault and ground-fault protection. Essential for older DFW homes adding EV chargers, pool equipment, or other high-draw appliances. Includes city permit and inspection.',
  ARRAY['New electrical panel and breakers', 'Transfer of all existing circuits', 'Main breaker and grounding upgrade', 'City permit and inspection coordination', 'Panel labeling and documentation'],
  ARRAY['Additional circuit installation', 'Meter base upgrade (utility company)', 'Whole-house rewiring'],
  3, 'configurator', 2,
  '{}',
  240, 480,
  '⚡', 1, TRUE, FALSE
);

-- 27. Outlet/Switch Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Outlet/Switch Installation',
  'outlet-switch-installation',
  'New outlet or switch installation, including GFCI and USB outlets',
  'Installation of a new electrical outlet or light switch at a desired location. Includes running wire from the nearest power source, cutting in the box, and installing the device. Covers standard, GFCI, USB, and smart switch options.',
  ARRAY['New electrical box cut-in and mounting', 'Wire run from nearest power source', 'Outlet or switch device installation', 'Circuit test and polarity verification'],
  ARRAY['Electrical panel upgrade', 'Drywall repair beyond box opening', 'Dedicated circuits for high-draw appliances'],
  5, 'instant_price', 1,
  '{}',
  30, 60,
  '🔌', 2, TRUE, FALSE
);

-- 28. Ceiling Fan Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Ceiling Fan Installation',
  'ceiling-fan-installation',
  'Professional ceiling fan installation or replacement at an existing electrical box',
  'Professional installation of a ceiling fan at an existing ceiling electrical box. Includes assembly, secure mounting with fan-rated box verification, wiring, and balancing. A must-have for DFW homes to improve airflow and reduce cooling costs.',
  ARRAY['Ceiling fan assembly and mounting', 'Fan-rated electrical box verification (upgrade if needed)', 'Wiring connections and switch setup', 'Blade balancing and operational test', 'Cleanup of packaging materials'],
  ARRAY['Ceiling fan cost (customer-supplied or add-on)', 'New electrical box where none exists', 'Vaulted ceiling adapter (available as add-on)'],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🌀', 3, TRUE, TRUE
);

-- 29. Recessed Lighting Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Recessed Lighting Installation',
  'recessed-lighting-installation',
  'LED recessed light installation for a clean, modern look',
  'Installation of recessed (can) lights in your ceiling. Includes cutting openings, running wiring, installing LED-rated housings, and connecting to a new or existing switch. Creates a clean, modern lighting look in any room.',
  ARRAY['Ceiling opening cuts for each light', 'Recessed housing installation (IC or non-IC rated)', 'Wiring from switch to each light location', 'LED trim and bulb installation', 'Switch installation or connection'],
  ARRAY['Light fixture cost (customer-supplied or add-on)', 'Drywall patching beyond light openings', 'Dimmer switch (available as add-on)'],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '💡', 4, TRUE, FALSE
);

-- 30. Whole-House Surge Protector
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Whole-House Surge Protector',
  'whole-house-surge-protector',
  'Protect your electronics and appliances from power surges',
  'Installation of a whole-house surge protection device at your main electrical panel. Protects all electronics, appliances, and HVAC equipment from damaging power surges caused by lightning and grid fluctuations common in DFW storm season.',
  ARRAY['Surge protector device installation at panel', 'Dedicated breaker connection', 'Grounding verification', 'Status indicator LED test'],
  ARRAY['Surge protector device cost (customer-supplied or add-on)', 'Electrical panel upgrade', 'Individual point-of-use surge strips'],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🛡️', 5, TRUE, FALSE
);

-- 31. EV Charger Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'EV Charger Installation',
  'ev-charger-installation',
  'Level 2 EV charger installation in your garage or driveway',
  'Professional installation of a Level 2 (240V) electric vehicle charger at your home. Includes dedicated circuit from your electrical panel, NEMA 14-50 outlet or hardwired connection, and mounting. Growing demand in DFW as EV adoption accelerates.',
  ARRAY['Dedicated 240V circuit from panel to charger location', 'NEMA 14-50 outlet or hardwired connection', 'Charger mounting (wall or pedestal)', 'Circuit breaker installation', 'City permit and inspection coordination'],
  ARRAY['EV charger unit cost (customer-supplied or add-on)', 'Electrical panel upgrade (if panel is full)', 'Trenching for detached garage runs'],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '🔋', 6, TRUE, FALSE
);

-- 32. Whole-House Generator Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'electrical'),
  'Whole-House Generator Installation',
  'whole-house-generator-installation',
  'Standby generator with automatic transfer switch for whole-home backup power',
  'Installation of a permanent standby generator with automatic transfer switch. Automatically powers your home during outages, a must-have after DFW''s increasing storm-related power disruptions. Includes concrete pad, gas connection, transfer switch, and city permit.',
  ARRAY['Generator unit placement on concrete pad', 'Automatic transfer switch installation', 'Gas line connection from existing supply', 'Electrical connection to main panel', 'City permit and inspection coordination'],
  ARRAY['Generator unit cost (quoted separately by brand/size)', 'Gas meter upgrade (utility company)', 'Concrete pad pouring (included if accessible)'],
  2, 'onsite_estimate', 4,
  '{}',
  480, 960,
  '⚡', 7, TRUE, FALSE
);

-- =============================================
-- SERVICES: INTERIOR FINISHES (9 services)
-- =============================================

-- 33. Interior Painting
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Interior Painting',
  'interior-painting',
  'Professional interior wall and ceiling painting with premium paints',
  'Professional interior painting service for walls and ceilings. Includes surface preparation, primer where needed, two coats of premium paint, and edge cutting. Transform any room with a fresh coat of paint from experienced painters.',
  ARRAY['Surface preparation (patching nail holes, light sanding)', 'Primer application where needed', 'Two coats of premium latex paint', 'Edge cutting at ceilings, trim, and corners', 'Furniture protection and floor covering'],
  ARRAY['Trim, door, or cabinet painting (available as add-on)', 'Wallpaper removal', 'Major drywall repair or texture matching'],
  3, 'photo_estimate', 3,
  '{}',
  240, 960,
  '🎨', 1, TRUE, FALSE
);

-- 34. Cabinet Refinishing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Cabinet Refinishing',
  'cabinet-refinishing',
  'Kitchen or bathroom cabinet refinishing for an updated look',
  'Professional refinishing of your existing kitchen or bathroom cabinets. Includes door and drawer removal, degreasing, sanding, primer, paint or stain application, and hardware reinstallation. A cost-effective alternative to full cabinet replacement.',
  ARRAY['Door and drawer front removal', 'Degreasing, sanding, and surface preparation', 'Primer and two coats of paint or stain', 'Cabinet box painting (face frames and visible interiors)', 'Hardware reinstallation'],
  ARRAY['New cabinet door or drawer replacement', 'Hardware cost (customer-supplied or add-on)', 'Interior shelf lining'],
  3, 'photo_estimate', 3,
  '{}',
  480, 960,
  '🗄️', 2, TRUE, FALSE
);

-- 35. Hardwood Floor Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Hardwood Floor Installation',
  'hardwood-floor-installation',
  'Solid or engineered hardwood floor installation',
  'Professional installation of solid or engineered hardwood flooring. Includes subfloor preparation, underlayment, hardwood installation, and transition strips at doorways. Available in nail-down, glue-down, or floating installation methods depending on subfloor type.',
  ARRAY['Subfloor inspection and preparation', 'Underlayment or moisture barrier installation', 'Hardwood flooring installation', 'Transition strips at doorways and thresholds', 'Final cleaning and debris removal'],
  ARRAY['Flooring material cost (customer-supplied or add-on)', 'Existing flooring removal (available as add-on)', 'Subfloor repair or leveling'],
  3, 'configurator', 2,
  '{}',
  480, 1440,
  '🪵', 3, TRUE, FALSE
);

-- 36. LVP/Laminate Floor Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'LVP/Laminate Floor Installation',
  'lvp-laminate-floor-installation',
  'Luxury vinyl plank or laminate flooring installation',
  'Professional installation of luxury vinyl plank (LVP) or laminate flooring. The most popular flooring choice for DFW homes due to durability, water resistance, and realistic wood-look finishes. Click-lock floating installation for fast turnaround.',
  ARRAY['Subfloor inspection and preparation', 'Underlayment installation', 'LVP or laminate flooring installation', 'Transition strips and molding at doorways', 'Final cleaning and debris removal'],
  ARRAY['Flooring material cost (customer-supplied or add-on)', 'Existing flooring removal (available as add-on)', 'Subfloor repair or leveling'],
  4, 'configurator', 2,
  '{}',
  240, 960,
  '🏠', 4, TRUE, FALSE
);

-- 37. Tile Floor Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Tile Floor Installation',
  'tile-floor-installation',
  'Ceramic, porcelain, or natural stone tile floor installation',
  'Professional tile floor installation using ceramic, porcelain, or natural stone tile. Includes surface preparation, thin-set application, tile layout with spacers, grouting, and sealing. Custom patterns and designs available.',
  ARRAY['Subfloor preparation and leveling', 'Thin-set mortar application', 'Tile installation with proper spacing', 'Grouting and grout sealing', 'Transition strip installation'],
  ARRAY['Tile material cost (customer-supplied or add-on)', 'Existing flooring removal (available as add-on)', 'Heated floor mat installation (available as add-on)'],
  3, 'photo_estimate', 3,
  '{}',
  480, 1440,
  '🔲', 5, TRUE, FALSE
);

-- 38. Carpet Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Carpet Installation',
  'carpet-installation',
  'Wall-to-wall carpet installation with padding',
  'Professional wall-to-wall carpet installation including carpet pad, tack strips, seaming, and stretching. Covers bedrooms, living areas, stairs, and closets. Includes furniture moving within the room (standard pieces).',
  ARRAY['Carpet pad installation', 'Tack strip installation around perimeter', 'Carpet stretching and seaming', 'Transition strips at doorways', 'Standard furniture moving within room'],
  ARRAY['Carpet material cost (customer-supplied or add-on)', 'Existing carpet removal and disposal (available as add-on)', 'Subfloor repair'],
  4, 'configurator', 2,
  '{}',
  240, 480,
  '🧶', 6, TRUE, FALSE
);

-- 39. Countertop Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Countertop Replacement',
  'countertop-replacement',
  'Kitchen or bathroom countertop replacement in granite, quartz, or other materials',
  'Professional countertop fabrication and installation for kitchens or bathrooms. Includes template measurement, fabrication, old countertop removal, installation, sink cutout, and sealing. Materials include granite, quartz, marble, butcher block, and solid surface.',
  ARRAY['Template measurement and fabrication', 'Old countertop removal and disposal', 'New countertop installation and leveling', 'Sink cutout and reconnection', 'Seam polishing and sealing'],
  ARRAY['Countertop material cost (quoted based on selection)', 'Plumbing fixture replacement', 'Cabinet modification or repair'],
  3, 'configurator', 2,
  '{}',
  240, 480,
  '🪨', 7, TRUE, FALSE
);

-- 40. Tub/Shower Reglazing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Tub/Shower Reglazing',
  'tub-shower-reglazing',
  'Bathtub or shower refinishing for a like-new appearance',
  'Professional reglazing (refinishing) of your existing bathtub or shower surround. Restores worn, stained, or outdated fixtures to a like-new finish at a fraction of replacement cost. Includes surface preparation, bonding agent, and durable topcoat.',
  ARRAY['Surface cleaning and etching', 'Chip and crack repair', 'Bonding agent application', 'Professional-grade topcoat spray application', 'Drain and overflow masking and cleanup'],
  ARRAY['Tub or shower replacement', 'Tile reglazing (available as add-on)', 'Plumbing fixture replacement'],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '🛁', 8, TRUE, FALSE
);

-- 41. Backsplash Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'interior-finishes'),
  'Backsplash Installation',
  'backsplash-installation',
  'Kitchen or bathroom tile backsplash installation',
  'Professional tile backsplash installation for kitchens and bathrooms. Includes surface preparation, tile layout planning, thin-set application, tile installation, grouting, and caulking at countertop and cabinet edges.',
  ARRAY['Surface preparation and wall priming', 'Tile layout planning and dry fit', 'Thin-set application and tile installation', 'Grouting and grout sealing', 'Caulking at countertop and cabinet edges'],
  ARRAY['Tile material cost (customer-supplied or add-on)', 'Electrical outlet relocation', 'Existing backsplash removal (available as add-on)'],
  3, 'photo_estimate', 3,
  '{}',
  240, 480,
  '🔳', 9, TRUE, FALSE
);

-- =============================================
-- SERVICES: APPLIANCES (2 services)
-- =============================================

-- 42. Appliance Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'appliances'),
  'Appliance Installation',
  'appliance-installation',
  'Professional installation of major household appliances',
  'Professional installation of major household appliances including dishwashers, ranges, ovens, microwaves, refrigerators, washers, and dryers. Includes unboxing, placement, connection to existing utilities, leveling, and operational test.',
  ARRAY['Appliance unboxing and placement', 'Connection to existing water, gas, or electrical', 'Leveling and securing', 'Operational test and walkthrough', 'Packaging removal and cleanup'],
  ARRAY['Appliance cost (customer-supplied)', 'New utility line installation', 'Cabinet or countertop modifications'],
  4, 'configurator', 2,
  '{}',
  60, 120,
  '🍳', 1, TRUE, FALSE
);

-- 43. Appliance Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'appliances'),
  'Appliance Repair',
  'appliance-repair',
  'Diagnostic and repair of major household appliances',
  'On-site diagnostic and repair of major household appliances including refrigerators, dishwashers, ovens, ranges, washers, dryers, and microwaves. Technician will diagnose the issue, provide upfront pricing, and complete the repair on the same visit when possible.',
  ARRAY['Complete appliance diagnostic', 'Upfront repair pricing before work begins', 'Repair of diagnosed issue', 'Operational test after repair'],
  ARRAY['Appliance replacement', 'Built-in or commercial-grade appliances', 'Warranty-covered repairs (contact manufacturer)'],
  2, 'onsite_estimate', 4,
  '{}',
  60, 180,
  '🔧', 2, TRUE, FALSE
);

-- =============================================
-- SERVICES: PEST CONTROL (2 services)
-- =============================================

-- 44. General Pest Control (Quarterly)
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pest-control'),
  'General Pest Control (Quarterly)',
  'general-pest-control-quarterly',
  'Quarterly interior and exterior pest treatment to keep bugs out year-round',
  'Quarterly preventive pest control treatment for your home''s interior and exterior. Targets common DFW pests including ants, roaches, spiders, silverfish, and crickets. Includes perimeter spray, entry point treatment, and interior spot treatment as needed.',
  ARRAY['Exterior perimeter spray treatment', 'Entry point and crack/crevice treatment', 'Interior spot treatment of problem areas', 'Web removal from eaves and corners', 'Pest activity report and recommendations'],
  ARRAY['Termite treatment (available as separate service)', 'Rodent control or trapping', 'Bed bug treatment'],
  5, 'instant_price', 1,
  '{}',
  30, 45,
  '🐜', 1, TRUE, TRUE
);

-- 45. Termite Inspection & Treatment
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pest-control'),
  'Termite Inspection & Treatment',
  'termite-inspection-treatment',
  'Professional termite inspection with treatment options for DFW subterranean termites',
  'Comprehensive termite inspection and treatment service. DFW is in a high-risk zone for subterranean termites. Includes thorough inspection of all accessible areas, moisture readings, and treatment using liquid barrier or bait station system.',
  ARRAY['Full property termite inspection', 'Moisture reading at foundation and high-risk areas', 'Written inspection report with photos', 'Treatment application (liquid barrier or bait stations)', 'Annual monitoring recommendation'],
  ARRAY['Structural repair of termite damage', 'Wood replacement', 'Fumigation (tenting)'],
  4, 'configurator', 2,
  '{}',
  60, 240,
  '🪲', 2, TRUE, FALSE
);

-- =============================================
-- SERVICE VARIABLES
-- =============================================

-- AC System Replacement variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'tonnage', 'System Size (Tons)', 'AC tonnage based on home square footage and insulation', 'select', '[{"value": "2", "label": "2 Ton (up to 1,200 sq ft)"}, {"value": "2.5", "label": "2.5 Ton (1,200-1,500 sq ft)"}, {"value": "3", "label": "3 Ton (1,500-1,800 sq ft)"}, {"value": "3.5", "label": "3.5 Ton (1,800-2,100 sq ft)"}, {"value": "4", "label": "4 Ton (2,100-2,400 sq ft)"}, {"value": "5", "label": "5 Ton (2,400-3,000 sq ft)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'seer', 'Efficiency Rating (SEER2)', 'Higher SEER means lower energy bills', 'select', '[{"value": "14.3", "label": "14.3 SEER2 (Standard)"}, {"value": "15.2", "label": "15.2 SEER2 (High Efficiency)"}, {"value": "16", "label": "16+ SEER2 (Premium Efficiency)"}, {"value": "17.5", "label": "17.5+ SEER2 (Ultra Efficiency)"}]', TRUE, TRUE, 2),
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'brand_tier', 'Brand Tier', 'Equipment brand and quality level', 'select', '[{"value": "value", "label": "Value (Goodman, Amana)"}, {"value": "mid", "label": "Mid-Range (Rheem, Ruud, York)"}, {"value": "premium", "label": "Premium (Trane, Carrier, Lennox)"}]', TRUE, TRUE, 3);

-- Mini-Split Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'mini-split-installation'), 'zones', 'Number of Zones', 'Each zone has its own indoor unit and thermostat', 'select', '[{"value": "1", "label": "1 Zone (Single Room)"}, {"value": "2", "label": "2 Zones"}, {"value": "3", "label": "3 Zones"}, {"value": "4", "label": "4 Zones"}, {"value": "5", "label": "5 Zones"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'mini-split-installation'), 'btu', 'Cooling Capacity (BTU)', 'BTU per zone based on room size', 'select', '[{"value": "9000", "label": "9,000 BTU (up to 300 sq ft)"}, {"value": "12000", "label": "12,000 BTU (300-500 sq ft)"}, {"value": "18000", "label": "18,000 BTU (500-800 sq ft)"}, {"value": "24000", "label": "24,000 BTU (800-1,200 sq ft)"}]', TRUE, TRUE, 2);

-- Tank Water Heater Replacement variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tank-water-heater-replacement'), 'capacity', 'Tank Size (Gallons)', 'Based on household size and usage', 'select', '[{"value": "30", "label": "30 Gallon (1-2 people)"}, {"value": "40", "label": "40 Gallon (2-3 people)"}, {"value": "50", "label": "50 Gallon (3-4 people)"}, {"value": "75", "label": "75 Gallon (4+ people)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'tank-water-heater-replacement'), 'fuel_type', 'Fuel Type', 'Must match your existing hookup', 'select', '[{"value": "gas", "label": "Natural Gas"}, {"value": "electric", "label": "Electric"}]', TRUE, TRUE, 2);

-- Tankless Water Heater Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tankless-water-heater-installation'), 'brand', 'Brand', 'Tankless water heater brand', 'select', '[{"value": "rinnai", "label": "Rinnai"}, {"value": "navien", "label": "Navien"}, {"value": "noritz", "label": "Noritz"}, {"value": "rheem", "label": "Rheem"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'tankless-water-heater-installation'), 'gpm', 'Flow Rate (GPM)', 'Gallons per minute based on household demand', 'select', '[{"value": "6.5", "label": "6.5 GPM (1-2 bathrooms)"}, {"value": "8", "label": "8.0 GPM (2-3 bathrooms)"}, {"value": "9.5", "label": "9.5 GPM (3-4 bathrooms)"}, {"value": "11", "label": "11.0 GPM (4+ bathrooms)"}]', TRUE, TRUE, 2);

-- Water Softener Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'water-softener-installation'), 'capacity', 'System Capacity (Grains)', 'Based on household size and water hardness', 'select', '[{"value": "32000", "label": "32,000 Grains (1-2 people)"}, {"value": "48000", "label": "48,000 Grains (3-4 people)"}, {"value": "64000", "label": "64,000 Grains (4-6 people)"}, {"value": "80000", "label": "80,000 Grains (6+ people)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'water-softener-installation'), 'type', 'Softener Type', 'Salt-based or salt-free system', 'select', '[{"value": "salt", "label": "Salt-Based (Traditional)"}, {"value": "salt_free", "label": "Salt-Free (Conditioner)"}]', TRUE, TRUE, 2);

-- Gas Line Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gas-line-installation'), 'run_length', 'Approximate Run Length', 'Distance from existing gas supply to new appliance', 'select', '[{"value": "short", "label": "Short (under 25 ft)"}, {"value": "medium", "label": "Medium (25-50 ft)"}, {"value": "long", "label": "Long (50-100 ft)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'gas-line-installation'), 'appliance_type', 'Appliance Type', 'What the gas line will serve', 'select', '[{"value": "grill", "label": "Outdoor Grill"}, {"value": "fire_pit", "label": "Fire Pit"}, {"value": "pool_heater", "label": "Pool Heater"}, {"value": "range", "label": "Kitchen Range"}, {"value": "generator", "label": "Generator"}, {"value": "dryer", "label": "Gas Dryer"}, {"value": "other", "label": "Other"}]', TRUE, FALSE, 2);

-- Electrical Panel Upgrade variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'electrical-panel-upgrade'), 'amps', 'Panel Amperage', 'Total electrical capacity for your home', 'select', '[{"value": "100", "label": "100 Amp (Basic - Small Homes)"}, {"value": "150", "label": "150 Amp (Standard)"}, {"value": "200", "label": "200 Amp (Recommended for Most Homes)"}, {"value": "320", "label": "320 Amp (Heavy Load - EV, Pool, Shop)"}, {"value": "400", "label": "400 Amp (Maximum Residential)"}]', TRUE, TRUE, 1);

-- Recessed Lighting Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'recessed-lighting-installation'), 'light_count', 'Number of Lights', 'How many recessed lights to install', 'select', '[{"value": "2", "label": "2 Lights"}, {"value": "4", "label": "4 Lights"}, {"value": "6", "label": "6 Lights"}, {"value": "8", "label": "8 Lights"}, {"value": "10", "label": "10 Lights"}, {"value": "12", "label": "12+ Lights"}]', TRUE, TRUE, 1);

-- EV Charger Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ev-charger-installation'), 'charger_level', 'Charger Level', 'Level 2 is standard for home charging', 'select', '[{"value": "level2_40a", "label": "Level 2 - 40 Amp (Most EVs)"}, {"value": "level2_50a", "label": "Level 2 - 50 Amp (Tesla, Trucks)"}, {"value": "level2_60a", "label": "Level 2 - 60 Amp (Fastest Home Charging)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'ev-charger-installation'), 'charger_brand', 'Charger Brand', 'Charger unit to install', 'select', '[{"value": "tesla_wall", "label": "Tesla Wall Connector"}, {"value": "chargepoint", "label": "ChargePoint Home Flex"}, {"value": "juicebox", "label": "JuiceBox"}, {"value": "grizzl_e", "label": "Grizzl-E"}, {"value": "customer", "label": "Customer-Supplied"}]', FALSE, TRUE, 2);

-- Interior Painting variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'interior-painting'), 'room_count', 'Number of Rooms', 'Rooms to be painted', 'select', '[{"value": "1", "label": "1 Room"}, {"value": "2", "label": "2 Rooms"}, {"value": "3", "label": "3 Rooms"}, {"value": "4", "label": "4 Rooms"}, {"value": "5", "label": "5+ Rooms (Whole Home)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'interior-painting'), 'wall_condition', 'Wall Condition', 'Amount of prep work needed', 'select', '[{"value": "good", "label": "Good (Minor nail holes only)"}, {"value": "fair", "label": "Fair (Some patches and repairs needed)"}, {"value": "poor", "label": "Poor (Significant prep work required)"}]', TRUE, TRUE, 2);

-- Hardwood Floor Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'hardwood-floor-installation'), 'wood_type', 'Wood Type', 'Solid or engineered hardwood', 'select', '[{"value": "engineered", "label": "Engineered Hardwood"}, {"value": "solid", "label": "Solid Hardwood"}, {"value": "hand_scraped", "label": "Hand-Scraped/Distressed"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'hardwood-floor-installation'), 'sqft', 'Approximate Square Footage', 'Total area to be covered', 'number', '{"min": 100, "max": 5000, "step": 50}', TRUE, TRUE, 2);

-- LVP/Laminate Floor Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'), 'material', 'Material Type', 'LVP or laminate flooring', 'select', '[{"value": "lvp_standard", "label": "LVP - Standard (4-6mm)"}, {"value": "lvp_premium", "label": "LVP - Premium (6-8mm with attached pad)"}, {"value": "laminate", "label": "Laminate"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'), 'sqft', 'Approximate Square Footage', 'Total area to be covered', 'number', '{"min": 100, "max": 5000, "step": 50}', TRUE, TRUE, 2);

-- Carpet Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'carpet-installation'), 'carpet_type', 'Carpet Type', 'Fiber and construction type', 'select', '[{"value": "polyester", "label": "Polyester (Budget-Friendly)"}, {"value": "nylon", "label": "Nylon (Durable, Most Popular)"}, {"value": "smartstrand", "label": "SmartStrand/Triexta (Stain-Resistant)"}, {"value": "wool", "label": "Wool (Premium)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'carpet-installation'), 'sqft', 'Approximate Square Footage', 'Total area to be carpeted', 'number', '{"min": 50, "max": 3000, "step": 50}', TRUE, TRUE, 2);

-- Countertop Replacement variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'countertop-replacement'), 'material', 'Countertop Material', 'Surface material selection', 'select', '[{"value": "laminate", "label": "Laminate"}, {"value": "butcher_block", "label": "Butcher Block"}, {"value": "granite", "label": "Granite"}, {"value": "quartz", "label": "Quartz"}, {"value": "marble", "label": "Marble"}, {"value": "solid_surface", "label": "Solid Surface (Corian)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'countertop-replacement'), 'linear_ft', 'Linear Feet of Countertop', 'Total countertop length', 'number', '{"min": 4, "max": 50, "step": 1}', TRUE, TRUE, 2);

-- Appliance Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'appliance-installation'), 'appliance_type', 'Appliance Type', 'Type of appliance to install', 'select', '[{"value": "dishwasher", "label": "Dishwasher"}, {"value": "range_gas", "label": "Gas Range/Oven"}, {"value": "range_electric", "label": "Electric Range/Oven"}, {"value": "microwave_otc", "label": "Over-the-Range Microwave"}, {"value": "refrigerator", "label": "Refrigerator (with water line)"}, {"value": "washer", "label": "Washing Machine"}, {"value": "dryer_gas", "label": "Gas Dryer"}, {"value": "dryer_electric", "label": "Electric Dryer"}]', TRUE, TRUE, 1);

-- Duct Sealing variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'duct-sealing'), 'home_size', 'Home Size', 'Approximate square footage of conditioned space', 'select', '[{"value": "small", "label": "Small (under 1,500 sq ft)"}, {"value": "medium", "label": "Medium (1,500-2,500 sq ft)"}, {"value": "large", "label": "Large (2,500-3,500 sq ft)"}, {"value": "xlarge", "label": "Extra Large (3,500+ sq ft)"}]', TRUE, TRUE, 1);

-- Air Purifier Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'air-purifier-installation'), 'purifier_type', 'Purifier Type', 'Air purification technology', 'select', '[{"value": "media_filter", "label": "High-Efficiency Media Filter"}, {"value": "electronic", "label": "Electronic Air Cleaner"}, {"value": "bipolar_ionization", "label": "Bipolar Ionization"}, {"value": "pcatalytic", "label": "Photocatalytic Oxidation (PCO)"}]', TRUE, TRUE, 1);

-- Heat Pump Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'heat-pump-installation'), 'tonnage', 'System Size (Tons)', 'Based on home square footage', 'select', '[{"value": "2", "label": "2 Ton (up to 1,200 sq ft)"}, {"value": "2.5", "label": "2.5 Ton (1,200-1,500 sq ft)"}, {"value": "3", "label": "3 Ton (1,500-1,800 sq ft)"}, {"value": "3.5", "label": "3.5 Ton (1,800-2,100 sq ft)"}, {"value": "4", "label": "4 Ton (2,100-2,400 sq ft)"}, {"value": "5", "label": "5 Ton (2,400-3,000 sq ft)"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'heat-pump-installation'), 'efficiency', 'Efficiency Level', 'Higher efficiency = lower energy bills', 'select', '[{"value": "standard", "label": "Standard Efficiency"}, {"value": "high", "label": "High Efficiency"}, {"value": "ultra", "label": "Ultra Efficiency (Variable Speed)"}]', TRUE, TRUE, 2);

-- Sump Pump Installation variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sump-pump-installation'), 'pump_type', 'Pump Type', 'Primary sump pump selection', 'select', '[{"value": "submersible_third", "label": "Submersible - 1/3 HP (Standard)"}, {"value": "submersible_half", "label": "Submersible - 1/2 HP (Heavy Duty)"}, {"value": "pedestal", "label": "Pedestal (Budget Option)"}]', TRUE, TRUE, 1);

-- Water Filtration System variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'water-filtration-system'), 'system_type', 'System Type', 'Filtration system scope and technology', 'select', '[{"value": "under_sink_ro", "label": "Under-Sink Reverse Osmosis"}, {"value": "under_sink_carbon", "label": "Under-Sink Carbon Filter"}, {"value": "whole_house_carbon", "label": "Whole-House Carbon Filter"}, {"value": "whole_house_multi", "label": "Whole-House Multi-Stage"}]', TRUE, TRUE, 1);

-- Tub/Shower Reglazing variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tub-shower-reglazing'), 'fixture_type', 'Fixture Type', 'What to reglaze', 'select', '[{"value": "tub_only", "label": "Bathtub Only"}, {"value": "tub_surround", "label": "Bathtub + Surround"}, {"value": "shower_only", "label": "Shower Stall Only"}, {"value": "shower_surround", "label": "Shower + Surround"}]', TRUE, TRUE, 1);

-- Termite Inspection & Treatment variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'termite-inspection-treatment'), 'treatment_type', 'Treatment Method', 'Termite treatment approach', 'select', '[{"value": "inspection_only", "label": "Inspection Only"}, {"value": "liquid_barrier", "label": "Liquid Barrier Treatment"}, {"value": "bait_stations", "label": "Bait Station System"}, {"value": "liquid_and_bait", "label": "Liquid Barrier + Bait Stations"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'termite-inspection-treatment'), 'home_size', 'Home Size', 'Approximate square footage (affects treatment coverage)', 'select', '[{"value": "small", "label": "Under 1,500 sq ft"}, {"value": "medium", "label": "1,500-2,500 sq ft"}, {"value": "large", "label": "2,500-3,500 sq ft"}, {"value": "xlarge", "label": "3,500+ sq ft"}]', TRUE, TRUE, 2);

-- Furnace Replacement variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'furnace-replacement'), 'fuel_type', 'Fuel Type', 'Gas or electric furnace', 'select', '[{"value": "gas", "label": "Natural Gas"}, {"value": "electric", "label": "Electric"}]', TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'furnace-replacement'), 'efficiency', 'Efficiency Rating (AFUE)', 'Higher AFUE = lower heating bills', 'select', '[{"value": "80", "label": "80% AFUE (Standard)"}, {"value": "90", "label": "90% AFUE (High Efficiency)"}, {"value": "96", "label": "96%+ AFUE (Ultra Efficiency)"}]', TRUE, TRUE, 2);

-- =============================================
-- SERVICE ADDONS
-- =============================================

-- AC System Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'Smart Thermostat', 'Add a Wi-Fi smart thermostat (Ecobee or Honeywell)', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'UV Light System', 'Germicidal UV light installed in air handler', 45000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), 'Duct Modification', 'Minor ductwork modifications for proper airflow', 75000, 3, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ac-system-replacement'), '10-Year Labor Warranty', 'Extended labor warranty beyond manufacturer coverage', 50000, 4, TRUE);

-- Furnace Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'furnace-replacement'), 'Smart Thermostat', 'Add a Wi-Fi smart thermostat', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'furnace-replacement'), 'CO Detector Installation', 'Hardwired carbon monoxide detector near furnace', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'furnace-replacement'), '10-Year Labor Warranty', 'Extended labor warranty beyond manufacturer coverage', 50000, 3, TRUE);

-- Heat Pump Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'heat-pump-installation'), 'Smart Thermostat', 'Heat pump compatible smart thermostat', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'heat-pump-installation'), 'Emergency Heat Kit', 'Auxiliary electric heat strips for extreme cold', 60000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'heat-pump-installation'), 'Surge Protector', 'Dedicated surge protector for outdoor unit', 15000, 3, TRUE);

-- Mini-Split Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'mini-split-installation'), 'Line Set Cover (Decorative)', 'Paintable decorative cover for exterior line set', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'mini-split-installation'), 'Wi-Fi Adapter', 'Smart control adapter for phone/voice control', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'mini-split-installation'), 'Condensate Pump', 'Required when gravity drain is not available', 20000, 3, TRUE);

-- AC Tune-Up addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ac-tune-up'), 'Capacitor Replacement', 'Preventive replacement of start/run capacitor', 12500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ac-tune-up'), 'Hard Start Kit', 'Reduces compressor startup strain and extends life', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ac-tune-up'), 'UV Light Installation', 'Add germicidal UV light to your system', 45000, 3, TRUE);

-- Duct Cleaning addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'duct-cleaning'), 'Dryer Vent Cleaning', 'Clean dryer exhaust vent to prevent fire hazard', 7500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'duct-cleaning'), 'Sanitizing Treatment', 'Antimicrobial duct sanitizer application', 10000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'duct-cleaning'), 'Return Air Filter Upgrade', 'Install high-efficiency air filter with new housing', 15000, 3, TRUE);

-- Duct Sealing addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'duct-sealing'), 'Duct Insulation', 'R-8 insulation wrap for attic ductwork', 50000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'duct-sealing'), 'Blower Door Test', 'Measure total home air leakage before and after', 20000, 2, TRUE);

-- Tank Water Heater Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tank-water-heater-replacement'), 'Drain Pan with Alarm', 'Safety pan with water leak alarm sensor', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tank-water-heater-replacement'), 'Water Shut-Off Valve Upgrade', 'Replace gate valve with quarter-turn ball valve', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tank-water-heater-replacement'), 'Thermal Expansion Tank', 'Required by code in closed-loop systems', 12500, 3, TRUE);

-- Tankless Water Heater Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tankless-water-heater-installation'), 'Recirculation Pump', 'Instant hot water at all fixtures (no waiting)', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tankless-water-heater-installation'), 'Scale Prevention System', 'Inline water treatment to prevent scale buildup', 20000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tankless-water-heater-installation'), 'Isolation Valve Kit', 'Easy-flush maintenance valves', 10000, 3, TRUE);

-- Drain Cleaning addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'drain-cleaning'), 'Camera Inspection', 'Video camera inspection of the drain line', 12500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'drain-cleaning'), 'Bio-Clean Treatment', 'Enzyme drain treatment to prevent future buildup', 5000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'drain-cleaning'), 'Additional Drain', 'Clear an additional drain in the same visit', 7500, 3, TRUE);

-- Faucet Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'faucet-replacement'), 'Supply Valve Replacement', 'Replace old shut-off valves under the sink', 5000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'faucet-replacement'), 'Garbage Disposal Connection', 'Connect or reconnect disposal during faucet work', 3500, 2, TRUE);

-- Toilet Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'toilet-replacement'), 'Flange Repair', 'Repair or replace damaged closet flange', 7500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'toilet-replacement'), 'Supply Valve Replacement', 'New quarter-turn shut-off valve', 3500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'toilet-replacement'), 'Bidet Seat Installation', 'Electric bidet seat installation (customer-supplied)', 7500, 3, TRUE);

-- Water Softener Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'water-softener-installation'), 'Dedicated Outdoor Faucet Bypass', 'Keep untreated water for outdoor irrigation', 10000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'water-softener-installation'), 'Reverse Osmosis Drinking System', 'Under-sink RO for pure drinking water', 40000, 2, TRUE);

-- Sewer Line Camera Inspection addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sewer-line-camera-inspection'), 'Locator Mark-Out', 'Mark the exact location and depth of issues on the ground', 10000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'sewer-line-camera-inspection'), 'Main Line Clearing', 'Clear blockage found during inspection', 17500, 2, TRUE);

-- Electrical Panel Upgrade addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'electrical-panel-upgrade'), 'Whole-House Surge Protector', 'Install surge protector with new panel', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'electrical-panel-upgrade'), 'AFCI Breaker Upgrade', 'Arc-fault breakers for bedroom circuits (code requirement)', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'electrical-panel-upgrade'), 'Generator Interlock Kit', 'Manual generator connection capability', 20000, 3, TRUE);

-- Ceiling Fan Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ceiling-fan-installation'), 'Vaulted Ceiling Adapter', 'Angled mounting adapter for sloped ceilings', 5000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ceiling-fan-installation'), 'Dimmer/Fan Speed Switch', 'Combo wall switch for light dimming and fan speed', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ceiling-fan-installation'), 'Additional Fan Installation', 'Install a second fan in the same visit', 10000, 3, TRUE);

-- Recessed Lighting Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'recessed-lighting-installation'), 'Dimmer Switch', 'Add a dimmer switch for adjustable brightness', 7500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'recessed-lighting-installation'), 'Smart Switch', 'Wi-Fi enabled smart dimmer switch', 12500, 2, TRUE);

-- EV Charger Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'ev-charger-installation'), 'Load Management Device', 'Smart panel monitor to avoid overloading', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'ev-charger-installation'), 'Cable Management', 'Wall-mounted cable holster and organizer', 5000, 2, TRUE);

-- Interior Painting addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'interior-painting'), 'Trim & Baseboard Painting', 'Paint all trim, baseboards, and door frames', 50000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'interior-painting'), 'Ceiling Painting', 'Paint ceiling in addition to walls', 25000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'interior-painting'), 'Accent Wall', 'Different color on one feature wall per room', 10000, 3, TRUE);

-- Cabinet Refinishing addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'cabinet-refinishing'), 'New Hardware', 'Replace all cabinet knobs and pulls (hardware included)', 30000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'cabinet-refinishing'), 'Soft-Close Hinges', 'Upgrade all hinges to soft-close', 20000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'cabinet-refinishing'), 'Interior Paint', 'Paint visible cabinet interiors', 25000, 3, TRUE);

-- Hardwood Floor Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'hardwood-floor-installation'), 'Existing Floor Removal', 'Remove and dispose of existing flooring', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'hardwood-floor-installation'), 'Stair Installation', 'Hardwood installation on stairs (per step)', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'hardwood-floor-installation'), 'Custom Stain Color', 'Site-applied custom stain (adds curing time)', 25000, 3, TRUE);

-- LVP/Laminate Floor Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'), 'Existing Floor Removal', 'Remove and dispose of existing flooring', 12500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'), 'Quarter Round Molding', 'New quarter round molding around perimeter', 10000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'lvp-laminate-floor-installation'), 'Furniture Moving', 'Move and replace standard furniture in work area', 7500, 3, TRUE);

-- Tile Floor Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tile-floor-installation'), 'Existing Floor Removal', 'Remove and dispose of existing flooring', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tile-floor-installation'), 'Heated Floor Mat', 'Electric radiant heating mat under tile', 50000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tile-floor-installation'), 'Custom Pattern/Inlay', 'Decorative tile pattern or border inlay', 25000, 3, TRUE);

-- Carpet Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'carpet-installation'), 'Old Carpet Removal', 'Remove and dispose of existing carpet and pad', 7500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'carpet-installation'), 'Premium Pad Upgrade', 'Upgrade to 8 lb density memory foam pad', 10000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'carpet-installation'), 'Stair Runner', 'Carpet runner installation on stairs', 25000, 3, TRUE);

-- Countertop Replacement addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'countertop-replacement'), 'Undermount Sink Cutout', 'Cutout and polish for undermount sink', 20000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'countertop-replacement'), 'Backsplash (4-inch)', 'Matching 4-inch backsplash along counter', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'countertop-replacement'), 'Waterfall Edge', 'Material continuation down one or both sides', 50000, 3, TRUE);

-- Tub/Shower Reglazing addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tub-shower-reglazing'), 'Non-Slip Surface', 'Textured non-slip coating on tub/shower floor', 10000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tub-shower-reglazing'), 'Color Change', 'Custom color instead of standard white', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tub-shower-reglazing'), 'Tile Reglazing', 'Reglaze surrounding wall tile to match', 25000, 3, TRUE);

-- Backsplash Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'backsplash-installation'), 'Old Backsplash Removal', 'Remove existing backsplash and prep wall', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'backsplash-installation'), 'Accent Strip', 'Decorative accent tile strip or border', 10000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'backsplash-installation'), 'Outlet/Switch Plate Upgrade', 'Color-matched outlet and switch covers', 2500, 3, TRUE);

-- Appliance Installation addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'appliance-installation'), 'Old Appliance Hauling', 'Remove and dispose of old appliance', 5000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'appliance-installation'), 'Water Line Installation', 'New water supply line for refrigerator or dishwasher', 10000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'appliance-installation'), 'Anti-Tip Bracket', 'Wall-mount anti-tip bracket for range (code requirement)', 3500, 3, TRUE);

-- General Pest Control addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'general-pest-control-quarterly'), 'Rodent Bait Stations', 'Exterior tamper-proof rodent bait stations (4 units)', 10000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'general-pest-control-quarterly'), 'Fire Ant Treatment', 'Targeted fire ant mound treatment in yard', 5000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'general-pest-control-quarterly'), 'Mosquito Barrier Spray', 'Perimeter mosquito treatment for yard', 7500, 3, TRUE);

-- Termite Inspection & Treatment addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'termite-inspection-treatment'), 'Annual Renewal Plan', 'Annual re-inspection and retreatment warranty', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'termite-inspection-treatment'), 'Damage Repair Warranty', 'Coverage for future termite damage repairs', 25000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'termite-inspection-treatment'), 'Wood-Destroying Insect Report', 'Official WDI report for real estate transactions', 7500, 3, TRUE);
