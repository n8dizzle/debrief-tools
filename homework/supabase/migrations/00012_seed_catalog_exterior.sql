-- =============================================
-- Migration 00012: Seed Catalog - THE EXTERIOR
-- =============================================
-- Department 2: 6 categories, 25 services
-- Roofing (4), Siding & Exterior Walls (4), Windows & Doors (8),
-- Foundation (3), Gutters (3), Insulation & Weatherproofing (3)

-- =============================================
-- DEPARTMENT
-- =============================================
INSERT INTO catalog_departments (name, slug, description, icon, display_order)
VALUES ('The Exterior', 'the-exterior', 'Roofing, siding, windows, doors, foundation, and exterior protection', '🏠', 2);

-- =============================================
-- CATEGORIES
-- =============================================
INSERT INTO catalog_categories (department_id, name, slug, description, icon, display_order) VALUES
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Roofing', 'roofing', 'Roof replacement, repair, inspection, and coating services', '🏗️', 1),
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Siding & Exterior Walls', 'siding-exterior-walls', 'Siding installation, brick repair, painting, and power washing', '🧱', 2),
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Windows & Doors', 'windows-doors', 'Window and door replacement, installation, tinting, and garage doors', '🪟', 3),
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Foundation', 'foundation', 'Foundation inspection, pier repair, and drainage correction', '🏛️', 4),
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Gutters', 'gutters', 'Gutter cleaning, installation, and guard systems', '🌧️', 5),
((SELECT id FROM catalog_departments WHERE slug = 'the-exterior'), 'Insulation & Weatherproofing', 'insulation-weatherproofing', 'Attic insulation, radiant barriers, and weather sealing', '🌡️', 6);

-- =============================================
-- ROOFING SERVICES (4)
-- =============================================

-- 1. Roof Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'roofing'),
  'Roof Replacement',
  'roof-replacement',
  'Complete tear-off and replacement of your existing roof with new materials',
  'Full roof replacement including removal of existing roofing materials down to the decking, inspection and repair of damaged decking, installation of new underlayment and roofing material, and final cleanup. Includes standard architectural shingles; upgrades available for premium materials.',
  ARRAY[
    'Complete tear-off of existing roofing material',
    'Inspection and repair of damaged roof decking (up to 2 sheets)',
    'Installation of new synthetic underlayment and drip edge',
    'Installation of new architectural shingles (30-year warranty)',
    'Cleanup and haul-away of all old materials'
  ],
  ARRAY[
    'Structural framing repairs or rafter replacement',
    'Skylight installation or replacement (available as add-on)',
    'Chimney rebuild or major flashing overhaul'
  ],
  3, 'photo_estimate', 3,
  '{}',
  960, 2880,
  '🏠', 1, TRUE, TRUE
);

-- Roof Replacement: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'roof-replacement'), 'roof_type', 'Roof Material', 'Select the roofing material for your new roof', 'select',
  '[{"value":"architectural_shingle","label":"Architectural Shingles (30-yr)","price_modifier":0},{"value":"premium_shingle","label":"Premium Designer Shingles (50-yr)","price_modifier":2500},{"value":"metal_standing_seam","label":"Standing Seam Metal","price_modifier":8000},{"value":"tile","label":"Concrete or Clay Tile","price_modifier":6000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'roof-replacement'), 'sqft_range', 'Approximate Roof Size', 'Estimated square footage of your roof', 'select',
  '[{"value":"under_1500","label":"Under 1,500 sq ft"},{"value":"1500_2500","label":"1,500 - 2,500 sq ft"},{"value":"2500_3500","label":"2,500 - 3,500 sq ft"},{"value":"over_3500","label":"Over 3,500 sq ft"}]',
  TRUE, TRUE, 2);

-- Roof Replacement: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'roof-replacement'), 'Ridge Vent Installation', 'Install continuous ridge vent for improved attic ventilation', 85000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'roof-replacement'), 'Skylight Installation', 'Add a new fixed or venting skylight during roof replacement', 150000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'roof-replacement'), 'Extra Decking Repair', 'Repair additional damaged decking beyond the included 2 sheets', 7500, 3, TRUE);

-- 2. Roof Leak Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'roofing'),
  'Roof Leak Repair',
  'roof-leak-repair',
  'Locate and repair active roof leaks to stop water intrusion',
  'Professional leak detection and targeted repair. Technician will identify the source of water intrusion, repair damaged shingles, flashing, or sealant, and verify the repair. Includes patching of up to 100 sq ft of affected area.',
  ARRAY[
    'Leak source identification and diagnostic inspection',
    'Replacement of damaged or missing shingles (up to 100 sq ft)',
    'Flashing repair or replacement at leak point',
    'Sealant application at penetrations and vulnerable areas',
    'Post-repair water test to verify fix'
  ],
  ARRAY[
    'Full roof replacement (see Roof Replacement service)',
    'Interior ceiling or drywall repair from water damage',
    'Structural repairs to rafters or trusses'
  ],
  3, 'photo_estimate', 3,
  '{}',
  120, 480,
  '💧', 2, TRUE, FALSE
);

-- 3. Roof Inspection
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'roofing'),
  'Roof Inspection',
  'roof-inspection',
  'Comprehensive roof evaluation with detailed condition report',
  'Thorough inspection of your entire roof system including shingles, flashing, gutters, vents, and decking condition. Includes a written report with photos, estimated remaining life, and recommended repairs. Ideal for annual maintenance, pre-purchase evaluation, or insurance claims.',
  ARRAY[
    'Full walk-through inspection of roof surface and penetrations',
    'Inspection of flashing, vents, boots, and edge trim',
    'Attic inspection for signs of leaks or ventilation issues',
    'Written report with photos and condition ratings',
    'Recommended maintenance and repair prioritization'
  ],
  ARRAY[
    'Any repair work (quoted separately based on findings)',
    'Drone or thermal imaging (available as add-on)'
  ],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🔍', 3, TRUE, FALSE
);

-- Roof Inspection: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'roof-inspection'), 'Drone Aerial Photography', 'High-resolution drone imagery for steep or hard-to-access roofs', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'roof-inspection'), 'Thermal Imaging Scan', 'Infrared scan to detect hidden moisture under roofing materials', 20000, 2, TRUE);

-- 4. Flat Roof Coating
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'roofing'),
  'Flat Roof Coating',
  'flat-roof-coating',
  'Apply reflective elastomeric coating to extend flat roof life',
  'Professional application of a seamless elastomeric or silicone roof coating over your existing flat or low-slope roof. Extends roof life by 10-15 years while improving energy efficiency with a reflective white surface. Ideal for commercial buildings, patio covers, and flat-roof sections.',
  ARRAY[
    'Power washing and preparation of existing roof surface',
    'Repair of minor cracks, blisters, and seam separations',
    'Application of primer coat as needed',
    'Application of elastomeric or silicone roof coating (2 coats)',
    'Final inspection and drainage verification'
  ],
  ARRAY[
    'Full roof replacement or structural decking repair',
    'Standing water correction requiring re-sloping',
    'Parapet wall or coping cap replacement'
  ],
  3, 'photo_estimate', 3,
  '{"property_type": ["single_family", "multi_family", "commercial"]}',
  240, 480,
  '🛡️', 4, TRUE, FALSE
);

-- =============================================
-- SIDING & EXTERIOR WALLS SERVICES (4)
-- =============================================

-- 5. Siding Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'siding-exterior-walls'),
  'Siding Installation',
  'siding-installation',
  'Full or partial siding replacement with your choice of material',
  'Professional removal of existing siding and installation of new siding material. Includes house wrap moisture barrier, trim, and J-channel around windows and doors. Price varies significantly by material choice and home size.',
  ARRAY[
    'Removal and disposal of existing siding',
    'Installation of house wrap moisture barrier',
    'Installation of new siding material with manufacturer specs',
    'Trim and J-channel around all windows and doors',
    'Cleanup and haul-away of old materials'
  ],
  ARRAY[
    'Structural sheathing or framing repair',
    'Window or door replacement',
    'Soffit and fascia replacement (available as add-on)'
  ],
  3, 'photo_estimate', 3,
  '{}',
  960, 2880,
  '🏗️', 1, TRUE, TRUE
);

-- Siding Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'siding-installation'), 'material_type', 'Siding Material', 'Choose your preferred siding material', 'select',
  '[{"value":"vinyl","label":"Vinyl Siding","price_modifier":0},{"value":"fiber_cement","label":"Fiber Cement (HardiePlank)","price_modifier":5000},{"value":"engineered_wood","label":"Engineered Wood (LP SmartSide)","price_modifier":3500},{"value":"metal","label":"Metal Panel Siding","price_modifier":7000}]',
  TRUE, TRUE, 1);

-- Siding Installation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'siding-installation'), 'Soffit & Fascia Replacement', 'Replace soffit and fascia boards alongside siding work', 250000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'siding-installation'), 'Insulated Siding Upgrade', 'Upgrade to insulated-back siding panels for improved R-value', 150000, 2, TRUE);

-- 6. Brick/Stone Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'siding-exterior-walls'),
  'Brick/Stone Repair',
  'brick-stone-repair',
  'Tuckpointing, mortar repair, and brick replacement for exterior walls',
  'Repair deteriorated mortar joints (tuckpointing), replace cracked or damaged bricks, and restore structural integrity and appearance of brick or stone exteriors. Common in DFW due to expansive clay soil movement.',
  ARRAY[
    'Assessment of mortar joint and brick condition',
    'Removal of deteriorated mortar (grinding/raking)',
    'Tuckpointing with color-matched mortar',
    'Replacement of cracked or spalled bricks (up to 20 bricks)',
    'Cleanup and debris removal'
  ],
  ARRAY[
    'Full brick veneer replacement or re-cladding',
    'Structural wall repair or foundation work',
    'Chimney rebuild above the roofline'
  ],
  3, 'photo_estimate', 3,
  '{"exterior_type": "brick"}',
  120, 480,
  '🧱', 2, TRUE, FALSE
);

-- 7. Exterior Painting
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'siding-exterior-walls'),
  'Exterior Painting',
  'exterior-painting',
  'Professional exterior painting including prep, prime, and two-coat finish',
  'Complete exterior painting of your home including pressure washing, scraping, caulking, priming bare spots, and applying two coats of premium exterior paint. Covers all siding, trim, soffits, and fascia. DFW sun exposure demands quality UV-resistant paint for lasting results.',
  ARRAY[
    'Pressure washing of all painted surfaces',
    'Scraping, sanding, and caulking of cracks and gaps',
    'Priming of bare wood, patched areas, and stains',
    'Two coats of premium exterior latex paint (Sherwin-Williams or equivalent)',
    'Trim, soffit, and fascia painting included'
  ],
  ARRAY[
    'Brick or stone painting (quoted separately)',
    'Lead paint abatement (pre-1978 homes may require testing)',
    'Deck or fence staining (see separate services)'
  ],
  3, 'photo_estimate', 3,
  '{}',
  480, 1440,
  '🎨', 3, TRUE, FALSE
);

-- Exterior Painting: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'exterior-painting'), 'stories', 'Number of Stories', 'How many stories is your home?', 'select',
  '[{"value":"1","label":"1 Story","price_modifier":0},{"value":"2","label":"2 Stories","price_modifier":3000},{"value":"3","label":"3 Stories","price_modifier":7000}]',
  TRUE, TRUE, 1);

-- Exterior Painting: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'exterior-painting'), 'Accent Color Package', 'Up to 3 accent colors for shutters, doors, and architectural details', 45000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'exterior-painting'), 'Wood Rot Repair', 'Repair rotted trim or fascia boards before painting (up to 20 linear ft)', 60000, 2, TRUE);

-- 8. Power Washing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'siding-exterior-walls'),
  'Power Washing',
  'power-washing',
  'High-pressure cleaning of exterior surfaces to remove dirt, mold, and stains',
  'Professional power washing of your home exterior, driveway, sidewalks, and patio. Removes built-up dirt, algae, mold, mildew, and oxidation. Uses appropriate pressure levels for each surface type to avoid damage. Great annual maintenance for DFW homes.',
  ARRAY[
    'Power wash home exterior siding (all sides)',
    'Driveway and front walkway cleaning',
    'Patio or back porch surface cleaning',
    'Application of mildew treatment to problem areas',
    'Careful pressure adjustment per surface type'
  ],
  ARRAY[
    'Second-story or higher areas requiring special rigging',
    'Soft wash chemical treatments for delicate surfaces (available as add-on)',
    'Fence or deck washing (available as add-on)'
  ],
  5, 'instant_price', 1,
  '{}',
  60, 180,
  '💦', 4, TRUE, TRUE
);

-- Power Washing: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'power-washing'), 'Fence Washing', 'Power wash wood or vinyl fence (up to 200 linear ft)', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'power-washing'), 'Deck/Patio Deep Clean', 'Extended treatment for heavily stained decks or patios', 12500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'power-washing'), 'Soft Wash Upgrade', 'Gentle chemical soft wash for stucco, painted wood, or delicate surfaces', 10000, 3, TRUE);

-- =============================================
-- WINDOWS & DOORS SERVICES (8)
-- =============================================

-- 9. Window Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Window Replacement',
  'window-replacement',
  'Energy-efficient replacement windows installed in existing openings',
  'Professional removal and replacement of existing windows with new energy-efficient vinyl or aluminum windows. Includes Low-E glass standard for DFW heat management. Retrofit installation into existing frames for a clean, fast upgrade without disturbing interior or exterior trim.',
  ARRAY[
    'Removal of existing window sash and hardware',
    'Installation of new retrofit window with Low-E glass',
    'Insulation and sealing around window frame',
    'Interior and exterior caulking and trim adjustment',
    'Cleanup and haul-away of old windows'
  ],
  ARRAY[
    'Full-frame window replacement requiring exterior siding modification',
    'Structural header repair or enlarging window openings',
    'Custom-shape windows (arched, octagonal, etc.) quoted separately'
  ],
  3, 'configurator', 2,
  '{}',
  120, 480,
  '🪟', 1, TRUE, TRUE
);

-- Window Replacement: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'window-replacement'), 'window_count', 'Number of Windows', 'How many windows are you replacing?', 'number',
  '{"min":1,"max":30,"step":1}',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'window-replacement'), 'window_type', 'Window Type', 'Select the style of replacement window', 'select',
  '[{"value":"single_hung","label":"Single Hung","price_modifier":0},{"value":"double_hung","label":"Double Hung","price_modifier":5000},{"value":"sliding","label":"Sliding","price_modifier":3000},{"value":"casement","label":"Casement","price_modifier":7000},{"value":"picture","label":"Picture (Fixed)","price_modifier":-2000}]',
  TRUE, TRUE, 2);

-- Window Replacement: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'window-replacement'), 'Triple Pane Upgrade', 'Upgrade to triple-pane glass for maximum insulation and noise reduction', 12000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'window-replacement'), 'Interior Trim Replacement', 'Replace interior window trim with new painted trim per window', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'window-replacement'), 'Grille/Grid Insert', 'Add decorative grille pattern between glass panes per window', 3500, 3, TRUE);

-- 10. Window Tinting
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Window Tinting',
  'window-tinting',
  'Professional window film installation for UV protection and energy savings',
  'Application of high-quality window film to reduce heat gain, block UV rays, and lower energy costs. Ceramic or nano-ceramic films reject up to 80% of infrared heat without darkening your view. Especially effective for DFW homes with south and west-facing windows.',
  ARRAY[
    'Surface cleaning and preparation of all windows',
    'Professional application of ceramic window film',
    'Trimming and edge sealing for a clean finish',
    'UV rejection up to 99% and infrared heat rejection up to 80%',
    'Manufacturer warranty registration'
  ],
  ARRAY[
    'Exterior window film application',
    'Removal of existing old or damaged window tint (available as add-on)',
    'Decorative or frosted privacy film (quoted separately)'
  ],
  4, 'configurator', 2,
  '{}',
  60, 240,
  '😎', 2, TRUE, FALSE
);

-- Window Tinting: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'window-tinting'), 'window_count', 'Number of Windows', 'How many windows to tint?', 'number',
  '{"min":1,"max":40,"step":1}',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'window-tinting'), 'film_type', 'Film Type', 'Choose the tint level and film type', 'select',
  '[{"value":"standard_ceramic","label":"Standard Ceramic Film","price_modifier":0},{"value":"premium_ceramic","label":"Premium Nano-Ceramic Film","price_modifier":3000},{"value":"security_film","label":"Security/Safety Film","price_modifier":5000}]',
  TRUE, TRUE, 2);

-- 11. Front Door Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Front Door Replacement',
  'front-door-replacement',
  'Upgrade your entry door with a new pre-hung or slab door installation',
  'Professional replacement of your front entry door including removal of existing door, installation of new pre-hung unit, weatherstripping, threshold, and hardware. Choose from fiberglass, steel, or wood options. A new front door is one of the highest-ROI upgrades for curb appeal and energy efficiency.',
  ARRAY[
    'Removal and disposal of existing door and frame',
    'Installation of new pre-hung entry door',
    'Weatherstripping and threshold seal installation',
    'New lockset and deadbolt installation (standard hardware)',
    'Interior and exterior trim and caulking'
  ],
  ARRAY[
    'Sidelite or transom window additions (requires framing modification)',
    'Smart lock or premium hardware (available as add-on)',
    'Structural header modification for wider openings'
  ],
  3, 'configurator', 2,
  '{}',
  120, 240,
  '🚪', 3, TRUE, FALSE
);

-- Front Door Replacement: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'front-door-replacement'), 'door_style', 'Door Style', 'Choose the style of your new front door', 'select',
  '[{"value":"panel","label":"Traditional Panel Door","price_modifier":0},{"value":"craftsman","label":"Craftsman Style","price_modifier":15000},{"value":"modern","label":"Modern/Contemporary","price_modifier":20000},{"value":"glass_insert","label":"Decorative Glass Insert","price_modifier":25000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'front-door-replacement'), 'door_material', 'Door Material', 'Select the door material', 'select',
  '[{"value":"fiberglass","label":"Fiberglass","price_modifier":0},{"value":"steel","label":"Steel (Insulated)","price_modifier":-5000},{"value":"wood","label":"Solid Wood","price_modifier":30000}]',
  TRUE, TRUE, 2);

-- Front Door Replacement: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'front-door-replacement'), 'Smart Lock Installation', 'Install a smart deadbolt with keypad and app control', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'front-door-replacement'), 'Storm Door Addition', 'Add a storm/screen door in front of new entry door', 45000, 2, TRUE);

-- 12. Sliding Door Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Sliding Door Installation',
  'sliding-door-installation',
  'Replace or install a new sliding patio door for indoor-outdoor living',
  'Professional installation of a new sliding glass patio door. Includes removal of existing door (if applicable), installation of new pre-hung sliding door unit, weatherstripping, and hardware. Upgrade options include multi-slide and pocket sliding doors.',
  ARRAY[
    'Removal and disposal of existing sliding door',
    'Installation of new pre-hung sliding glass door',
    'Weatherstripping and threshold sealing',
    'New handle set and locking hardware',
    'Interior and exterior trim and caulking'
  ],
  ARRAY[
    'Structural framing for new openings (requires header work)',
    'Electrical work for built-in blinds or motorized options',
    'Screen door replacement (available as add-on)'
  ],
  3, 'configurator', 2,
  '{}',
  120, 240,
  '🚪', 4, TRUE, FALSE
);

-- Sliding Door Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sliding-door-installation'), 'door_width', 'Door Width', 'Select the width of the sliding door unit', 'select',
  '[{"value":"6ft","label":"6 ft (Standard 2-Panel)","price_modifier":0},{"value":"8ft","label":"8 ft (Wide 2-Panel)","price_modifier":15000},{"value":"12ft","label":"12 ft (3 or 4-Panel)","price_modifier":40000}]',
  TRUE, TRUE, 1);

-- Sliding Door Installation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sliding-door-installation'), 'New Sliding Screen Door', 'Add a new sliding screen door to the patio door system', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'sliding-door-installation'), 'Built-In Blinds Upgrade', 'Upgrade to glass panels with integrated blinds between panes', 35000, 2, TRUE);

-- 13. Garage Door Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Garage Door Installation',
  'garage-door-installation',
  'New garage door with tracks, springs, and hardware',
  'Full garage door replacement including removal of existing door, installation of new door panels, tracks, springs, rollers, and all hardware. Includes balancing and safety testing. Does not include opener (see Garage Door Opener Installation). A new garage door is one of the top ROI home improvements.',
  ARRAY[
    'Removal and disposal of existing garage door',
    'Installation of new garage door panels and sections',
    'New tracks, springs, rollers, and hinges',
    'Door balancing and safety reverse testing',
    'Weatherstripping along bottom and sides'
  ],
  ARRAY[
    'Garage door opener installation (see separate service)',
    'Structural framing repairs to garage opening',
    'Electrical wiring for opener or exterior keypads'
  ],
  3, 'configurator', 2,
  '{}',
  180, 360,
  '🚗', 5, TRUE, FALSE
);

-- Garage Door Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'garage-door-installation'), 'door_type', 'Door Style', 'Select the garage door style', 'select',
  '[{"value":"raised_panel","label":"Raised Panel (Steel)","price_modifier":0},{"value":"carriage_house","label":"Carriage House Style","price_modifier":30000},{"value":"modern_flush","label":"Modern Flush Panel","price_modifier":25000},{"value":"glass_aluminum","label":"Full-View Glass & Aluminum","price_modifier":50000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'garage-door-installation'), 'door_size', 'Door Size', 'Select the garage door size', 'select',
  '[{"value":"single_8x7","label":"Single (8x7 ft)","price_modifier":0},{"value":"single_9x7","label":"Single Wide (9x7 ft)","price_modifier":5000},{"value":"double_16x7","label":"Double (16x7 ft)","price_modifier":20000},{"value":"double_18x7","label":"Double Wide (18x7 ft)","price_modifier":25000}]',
  TRUE, TRUE, 2);

-- Garage Door Installation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'garage-door-installation'), 'Insulation Upgrade', 'Upgrade to insulated door (R-value 12+) for climate-controlled garages', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'garage-door-installation'), 'Decorative Hardware Kit', 'Add decorative handles, hinges, and clavos for carriage house look', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'garage-door-installation'), 'Window Insert Row', 'Add a row of decorative window inserts to top panel', 20000, 3, TRUE);

-- 14. Garage Door Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Garage Door Repair',
  'garage-door-repair',
  'Fix springs, cables, rollers, tracks, or panels on your garage door',
  'Diagnose and repair common garage door issues including broken springs, frayed cables, worn rollers, bent tracks, and damaged panels. Includes parts and labor for standard repairs. Technician will inspect the entire door system and address all identified issues.',
  ARRAY[
    'Full diagnostic inspection of door, springs, cables, and tracks',
    'Replacement of broken torsion or extension springs',
    'Cable, roller, and hinge replacement as needed',
    'Track realignment and lubrication',
    'Safety reverse and balance testing after repair'
  ],
  ARRAY[
    'Full garage door replacement (see Garage Door Installation)',
    'Garage door opener repair or replacement (see separate services)',
    'Structural garage framing repairs'
  ],
  4, 'configurator', 2,
  '{}',
  60, 120,
  '🔧', 6, TRUE, FALSE
);

-- Garage Door Repair: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'garage-door-repair'), 'repair_type', 'Primary Issue', 'What is the main problem with your garage door?', 'select',
  '[{"value":"spring","label":"Broken Spring(s)","price_modifier":0},{"value":"cable","label":"Broken Cable(s)","price_modifier":-5000},{"value":"track","label":"Off Track / Bent Track","price_modifier":-3000},{"value":"panel","label":"Damaged Panel(s)","price_modifier":5000},{"value":"noise","label":"Noisy / Grinding","price_modifier":-7000},{"value":"unknown","label":"Not Sure - Need Diagnosis","price_modifier":0}]',
  TRUE, TRUE, 1);

-- 15. Garage Door Opener Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Garage Door Opener Installation',
  'garage-door-opener-installation',
  'Install a new belt-drive or chain-drive garage door opener with remotes',
  'Professional installation of a new residential garage door opener. Includes mounting the powerhead, rail assembly, safety sensors, wall button, and programming of two remotes. Belt-drive standard for quiet operation. Wi-Fi enabled models available for smartphone control.',
  ARRAY[
    'Installation of new garage door opener (belt-drive)',
    'Rail assembly and powerhead mounting',
    'Safety sensor installation and alignment',
    'Wall-mount button and two remote controls',
    'Programming and testing of all controls'
  ],
  ARRAY[
    'Electrical outlet installation (must have existing outlet within 3 ft)',
    'Garage door repair or replacement (see separate services)',
    'Additional remote controls beyond the included two'
  ],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '⚙️', 7, TRUE, FALSE
);

-- Garage Door Opener Installation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'garage-door-opener-installation'), 'Wi-Fi Smart Opener Upgrade', 'Upgrade to Wi-Fi enabled opener with smartphone app control', 10000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'garage-door-opener-installation'), 'Battery Backup', 'Add battery backup for operation during power outages', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'garage-door-opener-installation'), 'Extra Wireless Keypad', 'Add an exterior wireless keypad for code entry', 5000, 3, TRUE);

-- 16. Storm Door Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'windows-doors'),
  'Storm Door Installation',
  'storm-door-installation',
  'Add a storm or screen door to protect your entry and improve ventilation',
  'Professional installation of a new storm door (full-view, retractable screen, or ventilating) on your front, back, or side entry. Includes aluminum frame, glass/screen panel, closer hardware, and weatherstripping. Extends the life of your entry door and allows fresh air without bugs.',
  ARRAY[
    'Measurement and fitting to existing door frame',
    'Installation of storm door frame, hinges, and hardware',
    'Glass and/or screen panel installation',
    'Pneumatic or hydraulic door closer adjustment',
    'Weatherstripping and drip cap installation'
  ],
  ARRAY[
    'Entry door replacement (see Front Door Replacement)',
    'Door frame repair or modification',
    'Custom-size storm doors for non-standard openings'
  ],
  4, 'configurator', 2,
  '{}',
  90, 180,
  '🌪️', 8, TRUE, FALSE
);

-- Storm Door Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'storm-door-installation'), 'door_type', 'Storm Door Type', 'Select the type of storm door', 'select',
  '[{"value":"full_view","label":"Full-View Glass","price_modifier":0},{"value":"retractable_screen","label":"Retractable Screen","price_modifier":5000},{"value":"ventilating","label":"Ventilating (Self-Storing)","price_modifier":3000}]',
  TRUE, TRUE, 1);

-- =============================================
-- FOUNDATION SERVICES (3)
-- =============================================

-- 17. Foundation Inspection
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'foundation'),
  'Foundation Inspection',
  'foundation-inspection',
  'Professional foundation evaluation with engineering-grade report',
  'Comprehensive foundation inspection by a qualified structural specialist. Includes interior and exterior assessment, floor-level survey, measurement of cracks and deflection, and a detailed written report with recommendations. Critical for DFW homes on expansive clay soils. Suitable for all foundation types including slab-on-grade, pier-and-beam, and post-tension.',
  ARRAY[
    'Interior floor-level survey using manometer or laser level',
    'Exterior perimeter inspection for cracks and displacement',
    'Documentation of all visible cracks with measurements',
    'Assessment of doors, windows, and drywall for stress indicators',
    'Written report with diagrams, photos, and repair recommendations'
  ],
  ARRAY[
    'Any repair work (quoted separately based on findings)',
    'Structural engineering stamp or PE certification (available as upgrade)',
    'Plumbing leak detection under slab (see plumbing services)'
  ],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🏛️', 1, TRUE, TRUE
);

-- Foundation Inspection: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'foundation-inspection'), 'PE-Stamped Engineering Report', 'Upgrade to a licensed Professional Engineer stamped report for real estate or insurance', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'foundation-inspection'), 'Elevation Survey', 'Detailed elevation survey with digital floor plan and contour mapping', 15000, 2, TRUE);

-- 18. Foundation Pier Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'foundation'),
  'Foundation Pier Repair',
  'foundation-pier-repair',
  'Stabilize and lift settled foundation using pressed concrete or steel piers',
  'Professional foundation leveling using pressed piers (concrete or steel) driven to stable soil or bedrock. Includes excavation, pier installation, hydraulic lifting to restore foundation level, and backfill. The most common foundation repair in DFW due to the expansive clay soils that shift with moisture changes.',
  ARRAY[
    'Pre-repair elevation survey to determine settlement',
    'Excavation at pier locations around the perimeter',
    'Installation of pressed concrete or steel piers to refusal depth',
    'Hydraulic lifting of foundation to maximum practical recovery',
    'Backfill, compaction, and site cleanup'
  ],
  ARRAY[
    'Interior plumbing repairs under the slab',
    'Cosmetic crack repair to drywall, brick, or tile',
    'Drainage system installation (see Foundation Drainage Correction)'
  ],
  2, 'onsite_estimate', 4,
  '{}',
  480, 1440,
  '🔩', 2, TRUE, FALSE
);

-- 19. Foundation Drainage Correction
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'foundation'),
  'Foundation Drainage Correction',
  'foundation-drainage-correction',
  'Install French drains and grading improvements to protect your foundation',
  'Correct poor drainage around your foundation by installing French drains, surface drains, or re-grading soil to direct water away from the home. Essential for DFW homes where clay soil expansion and contraction from moisture causes the majority of foundation problems.',
  ARRAY[
    'Site assessment of drainage patterns and problem areas',
    'Trenching and installation of perforated French drain pipe',
    'Gravel backfill and filter fabric wrapping',
    'Surface grading correction to establish proper slope away from foundation',
    'Downspout extension or re-routing to drain system'
  ],
  ARRAY[
    'Foundation pier repair or leveling (see separate service)',
    'Sump pump installation (quoted separately if needed)',
    'Landscaping restoration beyond basic grading'
  ],
  2, 'onsite_estimate', 4,
  '{}',
  480, 960,
  '🌊', 3, TRUE, FALSE
);

-- =============================================
-- GUTTER SERVICES (3)
-- =============================================

-- 20. Gutter Cleaning
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'gutters'),
  'Gutter Cleaning',
  'gutter-cleaning',
  'Remove debris from gutters and downspouts to restore proper drainage',
  'Professional cleaning of all gutters and downspouts around your home. Technician removes leaves, twigs, shingle grit, and debris by hand and with blower. Includes flushing downspouts to confirm proper flow and a basic gutter condition assessment. Recommended twice per year in DFW.',
  ARRAY[
    'Removal of all debris from gutters by hand and blower',
    'Downspout flushing to confirm clear drainage',
    'Ground-level cleanup of debris removed from gutters',
    'Basic inspection for loose fasteners or visible damage',
    'Verification of proper water flow at all downspouts'
  ],
  ARRAY[
    'Gutter repair or re-attachment (quoted separately if needed)',
    'Gutter guard installation (see separate service)',
    'Roof debris removal beyond gutter line'
  ],
  5, 'instant_price', 1,
  '{"has_gutters": true}',
  60, 120,
  '🍂', 1, TRUE, TRUE
);

-- Gutter Cleaning: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gutter-cleaning'), 'Minor Gutter Repair', 'Reseal leaking joints or reattach up to 10 ft of loose gutter', 7500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'gutter-cleaning'), 'Downspout Extension', 'Add or extend downspout to direct water further from foundation (each)', 5000, 2, TRUE);

-- 21. Gutter Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'gutters'),
  'Gutter Installation',
  'gutter-installation',
  'New seamless aluminum gutters custom-fabricated and installed on-site',
  'Professional installation of seamless aluminum gutters custom-formed on-site to fit your home exactly. Includes gutters, downspouts, end caps, miters, and all hangers. Seamless construction means fewer leaks and a cleaner look than sectional gutters. Critical for DFW foundation protection.',
  ARRAY[
    'On-site custom fabrication of seamless aluminum gutters',
    'Installation of gutters with concealed hangers every 24 inches',
    'Downspout installation at optimal drainage points',
    'End caps, miters, and outlet connections',
    'Removal and disposal of old gutters (if applicable)'
  ],
  ARRAY[
    'Fascia board repair or replacement (available as add-on)',
    'Underground drainage tie-in or French drain',
    'Copper or half-round specialty gutters (quoted separately)'
  ],
  3, 'configurator', 2,
  '{}',
  240, 480,
  '🏗️', 2, TRUE, FALSE
);

-- Gutter Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gutter-installation'), 'material', 'Gutter Material', 'Select the gutter material', 'select',
  '[{"value":"aluminum_5in","label":"5\" Aluminum (Standard)","price_modifier":0},{"value":"aluminum_6in","label":"6\" Aluminum (Oversized)","price_modifier":3000},{"value":"steel","label":"Galvanized Steel","price_modifier":4000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'gutter-installation'), 'linear_feet', 'Estimated Linear Feet', 'Approximate total length of gutters needed', 'select',
  '[{"value":"under_100","label":"Under 100 ft"},{"value":"100_150","label":"100 - 150 ft"},{"value":"150_200","label":"150 - 200 ft"},{"value":"200_250","label":"200 - 250 ft"},{"value":"over_250","label":"Over 250 ft"}]',
  TRUE, TRUE, 2);

-- Gutter Installation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gutter-installation'), 'Fascia Board Replacement', 'Replace rotted or damaged fascia boards before gutter install (per 10 ft)', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'gutter-installation'), 'Splash Blocks', 'Concrete or plastic splash blocks at each downspout to direct water away', 2500, 2, TRUE);

-- 22. Gutter Guard Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'gutters'),
  'Gutter Guard Installation',
  'gutter-guard-installation',
  'Install leaf guards to reduce gutter maintenance and prevent clogs',
  'Professional installation of gutter guard systems over your existing gutters. Choose from micro-mesh, reverse-curve, or screen-style guards. Dramatically reduces gutter cleaning frequency and prevents clogs from leaves, pine needles, and shingle grit common in DFW.',
  ARRAY[
    'Cleaning of existing gutters before guard installation',
    'Installation of gutter guards on all accessible gutters',
    'Securing guards with clips or screws per manufacturer specs',
    'Downspout screen installation to prevent blockages',
    'Final flow test to verify proper water intake'
  ],
  ARRAY[
    'Gutter repair or replacement (must be in good condition)',
    'Underground drainage system installation',
    'Guards for specialty gutter shapes (half-round, box, etc.)'
  ],
  4, 'configurator', 2,
  '{"has_gutters": true}',
  120, 240,
  '🛡️', 3, TRUE, FALSE
);

-- Gutter Guard Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gutter-guard-installation'), 'guard_type', 'Guard Type', 'Select the style of gutter guard', 'select',
  '[{"value":"mesh_screen","label":"Mesh Screen Guards","price_modifier":0},{"value":"micro_mesh","label":"Micro-Mesh Guards (Premium)","price_modifier":5000},{"value":"reverse_curve","label":"Reverse Curve / Helmet Style","price_modifier":8000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'gutter-guard-installation'), 'linear_feet', 'Estimated Linear Feet', 'Approximate total length of gutters to cover', 'select',
  '[{"value":"under_100","label":"Under 100 ft"},{"value":"100_150","label":"100 - 150 ft"},{"value":"150_200","label":"150 - 200 ft"},{"value":"over_200","label":"Over 200 ft"}]',
  TRUE, TRUE, 2);

-- =============================================
-- INSULATION & WEATHERPROOFING SERVICES (3)
-- =============================================

-- 23. Attic Insulation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'insulation-weatherproofing'),
  'Attic Insulation',
  'attic-insulation',
  'Add or replace attic insulation to improve comfort and lower energy bills',
  'Professional installation of attic insulation to bring your home up to current energy code (R-38 minimum for DFW). Options include blown-in fiberglass, blown-in cellulose, or batt insulation. Proper attic insulation is one of the highest-impact energy upgrades for Texas homes where cooling costs dominate utility bills.',
  ARRAY[
    'Inspection of current insulation condition and R-value',
    'Air sealing of penetrations (can lights, vent stacks, wiring holes)',
    'Installation of insulation to target R-value (R-38 or higher)',
    'Baffles installed at eaves to maintain soffit ventilation',
    'Post-installation verification of coverage and depth'
  ],
  ARRAY[
    'Removal of existing insulation (available as add-on for contaminated insulation)',
    'Attic structural repairs or decking installation',
    'HVAC ductwork repair or replacement'
  ],
  4, 'configurator', 2,
  '{}',
  120, 360,
  '🧤', 1, TRUE, TRUE
);

-- Attic Insulation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'attic-insulation'), 'insulation_type', 'Insulation Type', 'Choose the type of insulation to install', 'select',
  '[{"value":"blown_fiberglass","label":"Blown-In Fiberglass","price_modifier":0},{"value":"blown_cellulose","label":"Blown-In Cellulose","price_modifier":-1000},{"value":"open_cell_foam","label":"Open-Cell Spray Foam","price_modifier":15000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'attic-insulation'), 'attic_sqft', 'Attic Square Footage', 'Approximate square footage of attic to insulate', 'select',
  '[{"value":"under_1000","label":"Under 1,000 sq ft"},{"value":"1000_1500","label":"1,000 - 1,500 sq ft"},{"value":"1500_2000","label":"1,500 - 2,000 sq ft"},{"value":"2000_2500","label":"2,000 - 2,500 sq ft"},{"value":"over_2500","label":"Over 2,500 sq ft"}]',
  TRUE, TRUE, 2);

-- Attic Insulation: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'attic-insulation'), 'Old Insulation Removal', 'Remove and dispose of existing contaminated or damaged insulation', 100000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'attic-insulation'), 'Attic Access Insulation Tent', 'Install insulated tent cover over attic access point for a tight seal', 15000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'attic-insulation'), 'Attic Fan Installation', 'Install solar or electric attic ventilation fan to reduce heat buildup', 45000, 3, TRUE);

-- 24. Radiant Barrier Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'insulation-weatherproofing'),
  'Radiant Barrier Installation',
  'radiant-barrier-installation',
  'Reflective radiant barrier in attic to block Texas heat and cut cooling costs',
  'Installation of radiant barrier foil or spray-on coating on the underside of your roof decking. Reflects up to 97% of radiant heat from entering your attic, reducing attic temperatures by 20-30 degrees in DFW summers. One of the most cost-effective energy upgrades for Texas homes.',
  ARRAY[
    'Installation of radiant barrier on underside of roof decking',
    'Coverage of all accessible attic roof surfaces',
    'Proper spacing maintained for ventilation airflow',
    'Sealing of seams and edges for continuous coverage',
    'Post-installation temperature reading documentation'
  ],
  ARRAY[
    'Attic insulation installation (see separate service)',
    'Roof repair or replacement',
    'HVAC ductwork modifications'
  ],
  4, 'configurator', 2,
  '{}',
  120, 240,
  '☀️', 2, TRUE, FALSE
);

-- Radiant Barrier Installation: Variables
INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'radiant-barrier-installation'), 'barrier_type', 'Barrier Type', 'Choose the radiant barrier application method', 'select',
  '[{"value":"foil_staple","label":"Reflective Foil (Stapled)","price_modifier":0},{"value":"spray_on","label":"Spray-On Radiant Barrier Coating","price_modifier":3000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'radiant-barrier-installation'), 'attic_sqft', 'Attic Square Footage', 'Approximate square footage of attic', 'select',
  '[{"value":"under_1000","label":"Under 1,000 sq ft"},{"value":"1000_1500","label":"1,000 - 1,500 sq ft"},{"value":"1500_2000","label":"1,500 - 2,000 sq ft"},{"value":"over_2000","label":"Over 2,000 sq ft"}]',
  TRUE, TRUE, 2);

-- 25. Weather Stripping & Caulking
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave,
  homefit_rules, estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'insulation-weatherproofing'),
  'Weather Stripping & Caulking',
  'weather-stripping-caulking',
  'Seal air leaks around doors, windows, and exterior penetrations',
  'Comprehensive air-sealing service targeting the most common sources of energy loss. Includes replacement of weatherstripping on all exterior doors, re-caulking of window and door frames, and sealing of visible gaps at exterior penetrations (pipes, vents, wiring). A quick, affordable way to improve comfort and reduce DFW energy bills.',
  ARRAY[
    'Replacement of weatherstripping on all exterior doors (up to 4 doors)',
    'Re-caulking of all window frames (exterior, up to 15 windows)',
    'Sealing of gaps at exterior pipe, vent, and wire penetrations',
    'Door threshold and sweep adjustment or replacement',
    'Visual inspection and air leak identification'
  ],
  ARRAY[
    'Window or door replacement (see separate services)',
    'Attic or wall insulation (see separate services)',
    'Interior caulking of bathrooms or kitchens'
  ],
  5, 'instant_price', 1,
  '{}',
  60, 120,
  '🌬️', 3, TRUE, FALSE
);

-- Weather Stripping & Caulking: Addons
INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'weather-stripping-caulking'), 'Additional Doors', 'Weatherstrip additional exterior doors beyond the included 4 (per door)', 3500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'weather-stripping-caulking'), 'Additional Windows', 'Caulk additional windows beyond the included 15 (per window)', 1500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'weather-stripping-caulking'), 'Garage Door Seal Kit', 'Replace all garage door seals (bottom, sides, and top)', 12500, 3, TRUE);
