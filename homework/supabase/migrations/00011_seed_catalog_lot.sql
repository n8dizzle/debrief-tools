-- =============================================
-- Migration 00011: Seed Catalog - THE LOT
-- =============================================
-- Department 1: THE LOT (30 services)
-- 5 categories: Lawn & Turf, Landscaping & Hardscaping,
--   Fencing, Driveway & Walkways, Pool & Outdoor Living

-- =========================
-- Department: THE LOT
-- =========================
INSERT INTO catalog_departments (name, slug, description, icon, display_order, is_active)
VALUES (
  'The Lot',
  'the-lot',
  'Outdoor and yard services including lawn care, landscaping, fencing, driveways, and pool maintenance for DFW homes.',
  'trees',
  1,
  TRUE
);

-- =========================
-- Categories
-- =========================
INSERT INTO catalog_categories (department_id, name, slug, description, icon, display_order, is_active) VALUES
((SELECT id FROM catalog_departments WHERE slug = 'the-lot'), 'Lawn & Turf', 'lawn-and-turf', 'Mowing, fertilization, aeration, irrigation, and weed control for DFW lawns.', 'grass', 1, TRUE),
((SELECT id FROM catalog_departments WHERE slug = 'the-lot'), 'Landscaping & Hardscaping', 'landscaping-and-hardscaping', 'Flower beds, tree work, patios, drainage, retaining walls, lighting, and mulch.', 'flower', 2, TRUE),
((SELECT id FROM catalog_departments WHERE slug = 'the-lot'), 'Fencing', 'fencing', 'Wood and metal fence installation, repair, and gate replacement.', 'fence', 3, TRUE),
((SELECT id FROM catalog_departments WHERE slug = 'the-lot'), 'Driveway & Walkways', 'driveway-and-walkways', 'Driveway sealing, replacement, and concrete leveling.', 'road', 4, TRUE),
((SELECT id FROM catalog_departments WHERE slug = 'the-lot'), 'Pool & Outdoor Living', 'pool-and-outdoor-living', 'Pool cleaning, equipment repair, resurfacing, pergolas, and outdoor kitchens.', 'pool', 5, TRUE);


-- ================================================================
-- CATEGORY 1: Lawn & Turf (9 services)
-- ================================================================

-- 1. Weekly Lawn Mowing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Weekly Lawn Mowing',
  'weekly-lawn-mowing',
  'Professional weekly mowing, edging, and blowing for a clean-cut DFW lawn.',
  'Reliable weekly lawn mowing service tailored to DFW turf types. Includes mowing at the proper height for your grass variety (Bermuda, St. Augustine, Zoysia), string-trimmer edging along all hardscapes, and blowing clippings off driveways and walkways.',
  ARRAY['Mow front and back yard at seasonal-appropriate height', 'String-trim edges along sidewalks, driveways, and beds', 'Blow clippings off all hard surfaces', 'Close and latch gates upon completion'],
  ARRAY['Backyard debris removal or dog waste pickup', 'Weed pulling or bed maintenance', 'Shrub or hedge trimming'],
  5, 'instant_price', 1, '{}',
  30, 60,
  'mower', 1, TRUE, TRUE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'weekly-lawn-mowing'), 'Dog Waste Pickup', 'Pre-mow pickup of pet waste from front and back yard.', 1500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'weekly-lawn-mowing'), 'Hedge Trimming', 'Trim hedges and shrubs along property perimeter (up to 50 linear feet).', 4500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'weekly-lawn-mowing'), 'Leaf Blowing (Fall Season)', 'Blow and pile fallen leaves for curbside pickup.', 3500, 3, TRUE);

-- 2. Lawn Fertilization Program
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Lawn Fertilization Program',
  'lawn-fertilization-program',
  'Seasonal fertilizer applications to keep your DFW lawn thick and green year-round.',
  'Custom fertilization program designed for North Texas warm-season grasses. Applications timed to DFW climate: spring green-up, summer growth, fall hardening, and optional winter pre-emergent. Uses granular or liquid fertilizer based on grass type and soil conditions.',
  ARRAY['Soil assessment to determine fertilizer needs', 'Granular or liquid fertilizer application across entire lawn', 'Treatment notes and next-visit scheduling', 'Flag placement to indicate treated areas'],
  ARRAY['Weed control spray (available as separate service)', 'Insect or grub treatment', 'Lawn aeration or overseeding'],
  4, 'configurator', 1, '{}',
  30, 45,
  'leaf', 2, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'lawn-fertilization-program'), 'lawn_size', 'Lawn Size', 'Approximate square footage of lawn area to be treated.', 'select',
  '[{"value": "small", "label": "Small (under 3,000 sq ft)", "price_modifier": 0}, {"value": "medium", "label": "Medium (3,000-6,000 sq ft)", "price_modifier": 3000}, {"value": "large", "label": "Large (6,000-10,000 sq ft)", "price_modifier": 6000}, {"value": "xlarge", "label": "Extra Large (10,000+ sq ft)", "price_modifier": 10000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'lawn-fertilization-program'), 'program_type', 'Program Type', 'Choose a single application or a seasonal program.', 'select',
  '[{"value": "single", "label": "Single Application", "price_modifier": 0}, {"value": "quarterly", "label": "Quarterly (4 applications/year)", "price_modifier": 8000}, {"value": "bimonthly", "label": "Bi-Monthly (6 applications/year)", "price_modifier": 14000}]',
  TRUE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'lawn-fertilization-program'), 'Soil pH Test', 'Lab-grade soil test with pH and nutrient analysis report.', 4500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'lawn-fertilization-program'), 'Pre-Emergent Herbicide', 'Add pre-emergent weed prevention to fertilizer application.', 3500, 2, TRUE);

-- 3. Core Aeration
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Core Aeration',
  'core-aeration',
  'Mechanical core aeration to relieve compacted DFW clay soil and promote root growth.',
  'Professional core aeration using a walk-behind or ride-on aerator. Pulls 2-3 inch soil plugs across the entire lawn to break up North Texas clay, improve water absorption, and encourage deeper root systems. Best performed in spring or fall for warm-season grasses.',
  ARRAY['Core aeration of front and back yard with walk-behind or ride-on aerator', 'Soil plugs left on lawn to decompose naturally', 'Flag sprinkler heads to avoid damage', 'Post-service watering recommendations provided'],
  ARRAY['Overseeding (available as separate service or add-on)', 'Top-dressing with compost or sand', 'Sprinkler head repair if damaged'],
  5, 'instant_price', 1, '{"sqft_min": 500}',
  45, 90,
  'dots-circle', 3, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'core-aeration'), 'Overseeding After Aeration', 'Spread grass seed immediately after aeration for optimal seed-to-soil contact.', 6000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'core-aeration'), 'Compost Top-Dressing', 'Spread thin layer of compost over aerated lawn to improve soil quality.', 8000, 2, TRUE);

-- 4. Overseeding
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Overseeding',
  'overseeding',
  'Spread quality grass seed to fill thin or bare spots in your lawn.',
  'Overseeding service to thicken existing turf or repair thin and bare patches. Seed variety selected for DFW climate and your existing grass type. Includes light raking of target areas for seed-to-soil contact and post-seeding watering instructions.',
  ARRAY['Broadcast or targeted seeding of front and back yard', 'Seed variety matched to existing turf type', 'Light raking of bare areas for seed contact', 'Written watering schedule for germination'],
  ARRAY['Core aeration prior to seeding (sold separately)', 'Sod replacement for large bare areas', 'Ongoing watering (homeowner responsibility)'],
  4, 'configurator', 2, '{}',
  45, 90,
  'seedling', 4, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'overseeding'), 'lawn_size', 'Lawn Size', 'Approximate square footage to be overseeded.', 'select',
  '[{"value": "small", "label": "Small (under 3,000 sq ft)", "price_modifier": 0}, {"value": "medium", "label": "Medium (3,000-6,000 sq ft)", "price_modifier": 4000}, {"value": "large", "label": "Large (6,000-10,000 sq ft)", "price_modifier": 8000}, {"value": "xlarge", "label": "Extra Large (10,000+ sq ft)", "price_modifier": 14000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'overseeding'), 'seed_type', 'Seed Type', 'Choose a seed variety appropriate for your lawn.', 'select',
  '[{"value": "bermuda", "label": "Bermuda Grass", "price_modifier": 0}, {"value": "st_augustine", "label": "St. Augustine", "price_modifier": 2000}, {"value": "zoysia", "label": "Zoysia", "price_modifier": 3000}, {"value": "fescue", "label": "Fescue (shade areas)", "price_modifier": 1500}]',
  TRUE, TRUE, 2);

-- 5. Sod Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Sod Installation',
  'sod-installation',
  'Full or partial sod replacement with fresh DFW-grown turf delivered and installed.',
  'Professional sod installation using locally grown turf appropriate for North Texas. Includes removal of existing dead grass or weeds, soil grading and preparation, sod delivery and installation with tight seams, and initial watering. Ideal for new construction, renovation, or replacing damaged lawn sections.',
  ARRAY['Remove existing dead grass or weeds from install area', 'Grade and prepare soil bed', 'Deliver and install fresh sod with tight seams', 'Initial deep watering after installation', 'Written care guide for first 30 days'],
  ARRAY['Sprinkler system installation or modification', 'Ongoing watering beyond initial soak (homeowner responsibility)', 'Large-scale grading or dirt hauling'],
  3, 'photo_estimate', 3, '{}',
  120, 480,
  'layers', 5, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sod-installation'), 'grass_type', 'Grass Type', 'Type of sod to install.', 'select',
  '[{"value": "bermuda_419", "label": "Bermuda 419 (full sun)", "price_modifier": 0}, {"value": "st_augustine_raleigh", "label": "St. Augustine Raleigh (shade tolerant)", "price_modifier": 1500}, {"value": "st_augustine_palmetto", "label": "St. Augustine Palmetto (premium)", "price_modifier": 3000}, {"value": "zoysia_palisades", "label": "Zoysia Palisades (low maintenance)", "price_modifier": 4000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'sod-installation'), 'area_sqft', 'Area (sq ft)', 'Approximate square footage of area to be sodded.', 'number',
  '{"min": 100, "max": 15000, "step": 100}',
  TRUE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sod-installation'), 'Soil Amendment', 'Mix in expanded shale and compost to improve DFW clay soil before laying sod.', 12000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'sod-installation'), 'Starter Fertilizer', 'Apply starter fertilizer to promote root establishment.', 3500, 2, TRUE);

-- 6. Sprinkler System Winterization
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Sprinkler System Winterization',
  'sprinkler-system-winterization',
  'Blow out and shut down your sprinkler system before the first DFW freeze.',
  'Complete sprinkler winterization to protect your irrigation system from North Texas freeze events. Includes shutting off the water supply, blowing compressed air through all zones to evacuate water from pipes and heads, and insulating the backflow preventer. Prevents costly freeze damage to valves, pipes, and sprinkler heads.',
  ARRAY['Shut off water supply to irrigation system', 'Compressed air blow-out of all zones', 'Insulate backflow preventer assembly', 'Verify controller is set to rain/off mode'],
  ARRAY['Repair of existing leaks or broken heads', 'Backflow preventer replacement', 'Spring system start-up (separate service)'],
  5, 'instant_price', 1, '{"has_sprinkler_system": true}',
  30, 60,
  'snowflake', 6, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sprinkler-system-winterization'), 'Backflow Preventer Cover', 'Install insulated cover over backflow preventer for added freeze protection.', 3500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'sprinkler-system-winterization'), 'Spring Start-Up Scheduling', 'Pre-schedule your spring start-up at a discounted rate when bundled with winterization.', 7500, 2, TRUE);

-- 7. Sprinkler Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Sprinkler Repair',
  'sprinkler-repair',
  'Diagnose and repair broken sprinkler heads, leaking valves, and controller issues.',
  'Troubleshoot and repair your existing irrigation system. Covers broken or stuck sprinkler heads, leaking zone valves, controller malfunctions, and minor pipe leaks. Technician will run each zone, identify issues, and make on-the-spot repairs with common parts carried on truck.',
  ARRAY['Diagnostic run of all irrigation zones', 'Replace up to 3 broken or clogged sprinkler heads', 'Repair or replace one leaking zone valve', 'Adjust head spray patterns for proper coverage', 'Test controller programming'],
  ARRAY['Main water line repair', 'Full zone additions or rerouting', 'Backflow preventer replacement or certification', 'Parts beyond standard heads and valves (quoted separately)'],
  3, 'photo_estimate', 3, '{"has_sprinkler_system": true}',
  60, 180,
  'wrench', 7, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'sprinkler-repair'), 'Smart Controller Upgrade', 'Replace existing timer with Wi-Fi-enabled smart irrigation controller.', 25000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'sprinkler-repair'), 'Rain Sensor Installation', 'Install rain sensor to auto-skip watering during rain events.', 8500, 2, TRUE);

-- 8. Sprinkler System Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Sprinkler System Installation',
  'sprinkler-system-installation',
  'Complete in-ground sprinkler system design and installation for your DFW property.',
  'Full irrigation system installation from design to activation. Includes property survey, zone layout design for optimal coverage, trenching, pipe and head installation, backflow preventer, controller setup, and system testing. Designed for North Texas water pressure and local code requirements.',
  ARRAY['On-site property survey and zone design', 'Trenching, pipe installation, and backfill', 'Sprinkler head installation across all zones', 'Backflow preventer installation per DFW code', 'Smart controller installation and programming'],
  ARRAY['Permit fees (if required by municipality)', 'Landscaping restoration beyond basic backfill', 'Connection to well or reclaimed water (standard municipal tap only)'],
  2, 'onsite_estimate', 4, '{}',
  480, 960,
  'droplets', 8, TRUE, FALSE
);

-- 9. Weed Control Treatment
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'lawn-and-turf'),
  'Weed Control Treatment',
  'weed-control-treatment',
  'Targeted herbicide application to eliminate broadleaf and grassy weeds from your lawn.',
  'Professional weed control treatment using selective herbicides safe for DFW warm-season turf. Targets common North Texas weeds including dandelions, clover, crabgrass, dallisgrass, and nutsedge. Applied by licensed technician with calibrated equipment for even coverage.',
  ARRAY['Selective herbicide application across entire lawn', 'Spot treatment of stubborn weed clusters', 'Treatment safe for Bermuda, St. Augustine, and Zoysia turf', 'Post-treatment care instructions provided'],
  ARRAY['Hand-pulling of weeds from flower beds', 'Non-selective treatments near ornamental plants', 'Lawn fertilization (available as separate service)'],
  5, 'instant_price', 1, '{}',
  20, 30,
  'bug-off', 9, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'weed-control-treatment'), 'Fire Ant Treatment', 'Broadcast and mound treatment for fire ants across the entire yard.', 4500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'weed-control-treatment'), 'Pre-Emergent Application', 'Apply pre-emergent herbicide to prevent future weed germination.', 3500, 2, TRUE);


-- ================================================================
-- CATEGORY 2: Landscaping & Hardscaping (9 services)
-- ================================================================

-- 10. Flower Bed Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Flower Bed Installation',
  'flower-bed-installation',
  'Design and install new flower beds with seasonal DFW-friendly plants and fresh mulch.',
  'Create beautiful new flower beds or fully renovate existing ones. Includes bed design consultation, soil preparation with compost amendments for DFW clay, plant selection appropriate for North Texas sun/shade conditions, installation, and mulch coverage. Plants chosen for seasonal color and low-water resilience.',
  ARRAY['Design consultation for bed layout and plant selection', 'Bed edging and soil preparation with compost amendment', 'Install seasonal plants appropriate for DFW climate', 'Apply 3-inch layer of mulch over planted areas', 'Initial watering and care instructions'],
  ARRAY['Irrigation system installation or modification', 'Retaining walls or raised bed structures', 'Ongoing plant replacement warranty beyond 30 days'],
  3, 'photo_estimate', 3, '{}',
  120, 360,
  'flower', 1, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-installation'), 'bed_size', 'Bed Size', 'Approximate total square footage of flower beds.', 'select',
  '[{"value": "small", "label": "Small (under 50 sq ft)", "price_modifier": 0}, {"value": "medium", "label": "Medium (50-150 sq ft)", "price_modifier": 15000}, {"value": "large", "label": "Large (150-300 sq ft)", "price_modifier": 35000}, {"value": "xlarge", "label": "Extra Large (300+ sq ft)", "price_modifier": 60000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-installation'), 'plant_tier', 'Plant Quality', 'Choose between standard nursery plants or premium selections.', 'select',
  '[{"value": "standard", "label": "Standard Seasonal Plants", "price_modifier": 0}, {"value": "premium", "label": "Premium / Perennial Mix", "price_modifier": 15000}]',
  TRUE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-installation'), 'Landscape Fabric', 'Install commercial landscape fabric under mulch for long-term weed suppression.', 5000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-installation'), 'Drip Irrigation', 'Install drip irrigation lines in new flower beds for efficient watering.', 18000, 2, TRUE);

-- 11. Flower Bed Maintenance
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Flower Bed Maintenance',
  'flower-bed-maintenance',
  'Weed, edge, prune, and refresh your existing flower beds to keep them looking sharp.',
  'Comprehensive flower bed clean-up and maintenance visit. Includes hand-weeding all beds, re-defining bed edges, pruning dead or overgrown plants, removing debris, and topping off mulch where thin. Keeps beds tidy between seasonal plantings.',
  ARRAY['Hand-weed all flower beds', 'Re-edge bed borders along lawn and hardscapes', 'Prune dead blooms, branches, and overgrowth', 'Remove debris and fallen leaves from beds', 'Top off mulch in thin spots (up to 2 bags included)'],
  ARRAY['Full mulch replacement (see Mulch Installation)', 'Plant replacement or new installations', 'Tree or large shrub pruning'],
  5, 'instant_price', 1, '{}',
  60, 120,
  'scissors', 2, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-maintenance'), 'Extra Mulch (per bag)', 'Additional bags of hardwood mulch beyond the 2 included.', 800, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'flower-bed-maintenance'), 'Seasonal Color Swap', 'Replace spent seasonal plants with fresh ones (up to 12 plants).', 8500, 2, TRUE);

-- 12. Tree Trimming
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Tree Trimming',
  'tree-trimming',
  'Professional pruning and shaping of trees to maintain health and curb appeal.',
  'Certified arborist-quality tree trimming for residential properties. Includes crown thinning, deadwood removal, clearance pruning away from structures and power lines, and shaping for aesthetics. All debris chipped or hauled away. Suitable for most DFW species including live oak, red oak, cedar elm, and crepe myrtle.',
  ARRAY['Prune and shape up to 3 trees', 'Remove deadwood and crossing branches', 'Clear branches from roofline, fences, and walkways', 'Chip or haul all debris from property'],
  ARRAY['Trees over 40 feet tall (requires crane crew quote)', 'Stump grinding after removal', 'Emergency storm damage response'],
  3, 'photo_estimate', 3, '{}',
  60, 240,
  'tree-pine', 3, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tree-trimming'), 'tree_count', 'Number of Trees', 'How many trees need trimming?', 'select',
  '[{"value": "1", "label": "1 Tree", "price_modifier": 0}, {"value": "2", "label": "2 Trees", "price_modifier": 10000}, {"value": "3", "label": "3 Trees", "price_modifier": 18000}, {"value": "4_plus", "label": "4+ Trees (will quote)", "price_modifier": 25000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'tree-trimming'), 'tree_height', 'Tree Height', 'Approximate height of tallest tree.', 'select',
  '[{"value": "under_15", "label": "Under 15 ft", "price_modifier": 0}, {"value": "15_25", "label": "15-25 ft", "price_modifier": 5000}, {"value": "25_40", "label": "25-40 ft", "price_modifier": 15000}]',
  TRUE, TRUE, 2);

-- 13. Tree Removal
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Tree Removal',
  'tree-removal',
  'Safe removal of dead, damaged, or unwanted trees from your property.',
  'Complete tree removal including felling or sectional takedown, limb chipping, trunk cutting, and debris haul-off. Crew assesses each tree for proximity to structures, power lines, and fences to determine the safest removal method. Stump is cut flush with grade; grinding available as an add-on.',
  ARRAY['Full tree takedown using safe rigging techniques', 'Limb chipping and trunk sectioning', 'Debris haul-off and site cleanup', 'Stump cut flush to ground level'],
  ARRAY['Stump grinding below grade (available as add-on)', 'Replacement tree planting', 'Permit fees if required by municipality'],
  2, 'onsite_estimate', 4, '{}',
  120, 480,
  'tree-deciduous', 4, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'tree-removal'), 'Stump Grinding', 'Grind stump 6-8 inches below grade and backfill with grindings.', 15000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'tree-removal'), 'Replacement Tree Planting', 'Plant a new tree in the same or nearby location (tree cost separate).', 12000, 2, TRUE);

-- 14. Patio Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Patio Installation',
  'patio-installation',
  'Custom patio design and build with pavers, stamped concrete, or natural stone.',
  'Full patio installation from design through completion. Includes layout design, excavation, gravel base preparation, material installation, and joint filling or sealing. Material options include concrete pavers, stamped concrete, flagstone, or travertine. Designed to handle DFW expansive clay soil conditions.',
  ARRAY['Design consultation and layout planning', 'Excavation and compacted gravel base preparation', 'Material installation with proper slope for drainage', 'Joint sand or grout fill and sealing', 'Site cleanup and debris removal'],
  ARRAY['Covered patio structures (see Pergola Installation)', 'Outdoor kitchen or firepit construction', 'Electrical or plumbing work for patio features', 'Permit fees if required'],
  2, 'onsite_estimate', 4, '{}',
  480, 960,
  'square', 5, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'patio-installation'), 'material', 'Patio Material', 'Choose your preferred patio surface material.', 'select',
  '[{"value": "concrete_pavers", "label": "Concrete Pavers", "price_modifier": 0}, {"value": "stamped_concrete", "label": "Stamped Concrete", "price_modifier": -5000}, {"value": "flagstone", "label": "Natural Flagstone", "price_modifier": 15000}, {"value": "travertine", "label": "Travertine", "price_modifier": 25000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'patio-installation'), 'patio_size', 'Patio Size', 'Approximate patio area in square feet.', 'number',
  '{"min": 50, "max": 1000, "step": 25}',
  TRUE, TRUE, 2);

-- 15. French Drain Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'French Drain Installation',
  'french-drain-installation',
  'Subsurface drainage system to redirect water away from your foundation and yard.',
  'Professional French drain installation to solve standing water and drainage issues common in DFW clay soil. Includes site grading assessment, trench excavation, perforated pipe placement with gravel backfill, and landscape restoration. Directs water away from foundations, patios, and low-lying yard areas.',
  ARRAY['Drainage assessment and slope planning', 'Trench excavation at proper grade', 'Perforated pipe installation with filter fabric and gravel', 'Backfill and landscape restoration', 'Pop-up emitter or daylight outlet at discharge point'],
  ARRAY['Foundation repair or leveling', 'Sump pump installation', 'Routing drainage across neighboring property', 'Permit fees if required by municipality'],
  2, 'onsite_estimate', 4, '{}',
  480, 960,
  'arrow-down-to-line', 6, TRUE, FALSE
);

-- 16. Retaining Wall
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Retaining Wall',
  'retaining-wall',
  'Structural retaining wall to manage slopes, prevent erosion, and add visual appeal.',
  'Design and construct a retaining wall using segmental block, natural stone, or treated timber. Includes excavation, compacted base, drainage gravel backfill, and cap installation. Engineered for DFW soil conditions to handle lateral earth pressure and prevent erosion on sloped lots.',
  ARRAY['Site assessment and wall design', 'Excavation and compacted base preparation', 'Wall construction with drainage aggregate behind wall', 'Cap stones or timber top rail installation', 'Backfill and site cleanup'],
  ARRAY['Walls over 4 feet (requires engineered plans)', 'Electrical or water features integrated into wall', 'Regrading beyond immediate wall area'],
  2, 'onsite_estimate', 4, '{}',
  480, 960,
  'bricks', 7, TRUE, FALSE
);

-- 17. Outdoor Lighting Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Outdoor Lighting Installation',
  'outdoor-lighting-installation',
  'Low-voltage LED landscape lighting for paths, beds, trees, and architectural accents.',
  'Professional low-voltage LED landscape lighting design and installation. Includes lighting plan, transformer sizing, wire burial, and fixture placement for paths, flower beds, tree uplighting, and architectural accents. Energy-efficient LED fixtures with photocell or smart timer control.',
  ARRAY['Lighting design consultation and fixture layout', 'Low-voltage transformer installation', 'Wire trenching and burial to code depth', 'Fixture installation and aiming', 'Timer or photocell programming'],
  ARRAY['High-voltage (120V) electrical work', 'Security camera or floodlight installation', 'Ongoing bulb replacement warranty'],
  3, 'configurator', 2, '{}',
  120, 360,
  'lightbulb', 8, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'outdoor-lighting-installation'), 'fixture_count', 'Number of Fixtures', 'How many light fixtures to install.', 'select',
  '[{"value": "6", "label": "6 Fixtures (starter)", "price_modifier": 0}, {"value": "10", "label": "10 Fixtures (standard)", "price_modifier": 20000}, {"value": "15", "label": "15 Fixtures (deluxe)", "price_modifier": 45000}, {"value": "20_plus", "label": "20+ Fixtures (premium)", "price_modifier": 75000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'outdoor-lighting-installation'), 'fixture_finish', 'Fixture Finish', 'Choose the finish for your light fixtures.', 'select',
  '[{"value": "bronze", "label": "Antique Bronze", "price_modifier": 0}, {"value": "black", "label": "Matte Black", "price_modifier": 0}, {"value": "brass", "label": "Solid Brass (premium)", "price_modifier": 15000}]',
  FALSE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'outdoor-lighting-installation'), 'Smart Controller', 'Wi-Fi smart transformer with app control and scheduling.', 18000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'outdoor-lighting-installation'), 'Tree Uplighting Kit', 'Add 3 adjustable spotlights for dramatic tree uplighting.', 22000, 2, TRUE);

-- 18. Mulch Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'landscaping-and-hardscaping'),
  'Mulch Installation',
  'mulch-installation',
  'Fresh mulch delivered and spread across all flower beds and tree rings.',
  'Bulk mulch delivery and installation across all landscape beds. Includes clearing old mulch surface, re-defining bed edges, and spreading fresh mulch to a 3-inch depth. Choice of hardwood, cedar, or black-dyed mulch. Suppresses weeds, retains moisture, and refreshes curb appeal.',
  ARRAY['Clear debris from existing beds', 'Re-edge all bed borders', 'Deliver and spread mulch to 3-inch depth', 'Mulch around trees with proper trunk clearance', 'Clean up all pathways and driveways after spreading'],
  ARRAY['Landscape fabric installation (available as add-on)', 'Flower bed planting or renovation', 'Rock or gravel ground cover (different service)'],
  5, 'instant_price', 1, '{}',
  60, 180,
  'layers', 9, TRUE, TRUE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'mulch-installation'), 'Landscape Fabric', 'Install weed barrier fabric under mulch in all beds.', 6000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'mulch-installation'), 'Bed Expansion', 'Extend existing beds by up to 25 sq ft with new edging.', 8500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'mulch-installation'), 'Cedar Mulch Upgrade', 'Upgrade from standard hardwood to aromatic cedar mulch.', 4000, 3, TRUE);


-- ================================================================
-- CATEGORY 3: Fencing (4 services)
-- ================================================================

-- 19. Wood Fence Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'fencing'),
  'Wood Fence Installation',
  'wood-fence-installation',
  'New cedar or pine privacy fence built to DFW wind-load standards.',
  'Full wood fence installation using premium cedar or treated pine. Includes post hole digging with concrete footings, rail and picket installation, and gate construction. Built to withstand DFW high winds with 4x4 posts set 24-30 inches deep in concrete. Standard styles: board-on-board privacy, side-by-side, or cap-and-trim.',
  ARRAY['Post hole digging with concrete footings at 8-foot spacing', 'Pressure-treated or cedar posts, rails, and pickets', 'One single gate with hardware included', 'Built to city code height requirements', 'Cleanup of all construction debris'],
  ARRAY['Removal of existing fence (available as add-on)', 'Survey or property line verification', 'HOA approval process (homeowner responsibility)', 'Staining or painting (available as add-on)'],
  3, 'configurator', 2, '{"has_fence": false}',
  480, 960,
  'fence', 1, TRUE, TRUE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'fence_height', 'Fence Height', 'Standard fence height.', 'select',
  '[{"value": "6ft", "label": "6 Foot (standard privacy)", "price_modifier": 0}, {"value": "8ft", "label": "8 Foot (tall privacy)", "price_modifier": 50000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'linear_feet', 'Linear Feet', 'Total length of fence in linear feet.', 'number',
  '{"min": 20, "max": 500, "step": 5}',
  TRUE, TRUE, 2),
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'wood_type', 'Wood Type', 'Choose your fence material.', 'select',
  '[{"value": "treated_pine", "label": "Pressure-Treated Pine", "price_modifier": 0}, {"value": "western_cedar", "label": "Western Red Cedar", "price_modifier": 30000}, {"value": "board_on_board_cedar", "label": "Board-on-Board Cedar (premium)", "price_modifier": 50000}]',
  TRUE, TRUE, 3);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'Old Fence Removal', 'Remove and haul away existing fence before new installation.', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'Double Gate', 'Add a double-wide gate for vehicle or equipment access (8-10 ft opening).', 45000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-installation'), 'Fence Staining', 'Apply one coat of semi-transparent stain to entire new fence.', 25000, 3, TRUE);

-- 20. Wood Fence Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'fencing'),
  'Wood Fence Repair',
  'wood-fence-repair',
  'Repair storm damage, leaning sections, broken pickets, and rotted posts.',
  'Targeted repair of damaged wood fence sections. Common repairs include replacing broken or missing pickets, resetting leaning posts with new concrete, replacing rotted post bases, reattaching loose rails, and fixing gate alignment. Materials matched to existing fence as closely as possible.',
  ARRAY['Replace up to 10 damaged or missing pickets', 'Reset or replace up to 2 leaning or rotted posts', 'Reattach loose rails and tighten hardware', 'Adjust gate for proper swing and latch'],
  ARRAY['Full fence replacement (see installation service)', 'Staining or painting repaired sections', 'Neighbor-side repairs without property access'],
  3, 'photo_estimate', 3, '{"has_fence": true, "fence_material": "wood"}',
  120, 240,
  'hammer', 2, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-repair'), 'Additional Post Replacement', 'Replace extra posts beyond the 2 included (per post).', 12000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'wood-fence-repair'), 'Section Staining', 'Stain repaired fence sections to match existing finish.', 8000, 2, TRUE);

-- 21. Iron/Metal Fence Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'fencing'),
  'Iron/Metal Fence Installation',
  'iron-metal-fence-installation',
  'Ornamental iron or aluminum fence installation for security and curb appeal.',
  'Professional installation of ornamental iron or powder-coated aluminum fencing. Includes post hole digging with concrete footings, panel installation, and single gate with self-closing hinges. Available in a range of styles from flat-top to spear-point. Ideal for front yards, pools (code-compliant options), and perimeter fencing.',
  ARRAY['Post hole digging with concrete footings', 'Panel and post installation per manufacturer specs', 'One single walk-through gate with hardware', 'Built to city code and HOA standards', 'Debris cleanup'],
  ARRAY['Custom fabrication or ornamental details', 'Automatic gate opener installation', 'Removal of existing fence (available as add-on)', 'Powder-coating or painting on-site'],
  3, 'configurator', 2, '{"has_fence": false}',
  480, 960,
  'fence', 3, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'iron-metal-fence-installation'), 'material', 'Fence Material', 'Choose between iron and aluminum.', 'select',
  '[{"value": "aluminum", "label": "Powder-Coated Aluminum (low maintenance)", "price_modifier": 0}, {"value": "wrought_iron", "label": "Wrought Iron (classic, heavier)", "price_modifier": 40000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'iron-metal-fence-installation'), 'linear_feet', 'Linear Feet', 'Total length of fence in linear feet.', 'number',
  '{"min": 20, "max": 500, "step": 5}',
  TRUE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'iron-metal-fence-installation'), 'Old Fence Removal', 'Remove and haul away existing fence before installation.', 30000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'iron-metal-fence-installation'), 'Pool Code Compliance', 'Self-closing, self-latching gate and 4ft+ height per DFW pool codes.', 15000, 2, TRUE);

-- 22. Gate Repair/Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'fencing'),
  'Gate Repair/Replacement',
  'gate-repair-replacement',
  'Fix sagging, sticking, or broken gates -- or replace them entirely.',
  'Repair or full replacement of residential gates. Common issues include sagging from worn hinges, wood rot at the bottom rail, misaligned latches, and broken hardware. Replacement gates are built to match existing fence style and material. Includes hardware upgrade to heavy-duty hinges and self-closing mechanisms when needed.',
  ARRAY['Diagnose gate issue (sag, rot, hardware failure)', 'Repair or replace hinges, latches, and hardware', 'Rehang and align gate for smooth operation', 'Replace gate if repair is not viable (materials matched to existing fence)'],
  ARRAY['Full fence section repair (see fence repair services)', 'Automatic gate opener installation or repair', 'Double-wide driveway gate construction'],
  3, 'photo_estimate', 3, '{"has_fence": true}',
  60, 180,
  'door-open', 4, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'gate-repair-replacement'), 'Self-Closing Hinge Kit', 'Upgrade to heavy-duty self-closing hinges (required for pool gates).', 6500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'gate-repair-replacement'), 'Decorative Hardware', 'Upgrade latch and hinges to decorative black iron finish.', 4500, 2, TRUE);


-- ================================================================
-- CATEGORY 4: Driveway & Walkways (3 services)
-- ================================================================

-- 23. Driveway Sealing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'driveway-and-walkways'),
  'Driveway Sealing',
  'driveway-sealing',
  'Seal and protect your asphalt or concrete driveway from DFW heat, rain, and UV damage.',
  'Professional driveway sealing to extend surface life and restore a fresh appearance. Includes pressure washing to remove dirt and debris, crack filling for minor cracks, and application of commercial-grade sealant. Protects against DFW summer heat, UV fading, water penetration, and oil stains.',
  ARRAY['Pressure wash entire driveway surface', 'Fill minor cracks up to 1/4 inch wide', 'Apply two coats of commercial-grade sealant', 'Barricade driveway during 24-hour cure time', 'Move barricades after cure (or leave for homeowner)'],
  ARRAY['Major crack repair or structural patching', 'Concrete leveling or mudjacking', 'Driveway replacement'],
  4, 'configurator', 2, '{}',
  120, 240,
  'paintbrush', 1, TRUE, FALSE
);

INSERT INTO catalog_service_variables (service_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order) VALUES
((SELECT id FROM catalog_services WHERE slug = 'driveway-sealing'), 'driveway_size', 'Driveway Size', 'Approximate driveway area.', 'select',
  '[{"value": "single", "label": "Single Car (~200 sq ft)", "price_modifier": 0}, {"value": "double", "label": "Double Car (~400 sq ft)", "price_modifier": 8000}, {"value": "triple", "label": "Triple / Extended (~600 sq ft)", "price_modifier": 16000}, {"value": "large", "label": "Large / Circular (~800+ sq ft)", "price_modifier": 25000}]',
  TRUE, TRUE, 1),
((SELECT id FROM catalog_services WHERE slug = 'driveway-sealing'), 'surface_type', 'Surface Type', 'What is your driveway made of?', 'select',
  '[{"value": "asphalt", "label": "Asphalt", "price_modifier": 0}, {"value": "concrete", "label": "Concrete", "price_modifier": 3000}, {"value": "pavers", "label": "Pavers (polymeric sand seal)", "price_modifier": 8000}]',
  TRUE, TRUE, 2);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'driveway-sealing'), 'Oil Stain Treatment', 'Pre-treat oil stains with degreaser before pressure washing.', 3500, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'driveway-sealing'), 'Walkway Sealing', 'Add front walkway sealing to the same visit.', 6000, 2, TRUE);

-- 24. Driveway Replacement
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'driveway-and-walkways'),
  'Driveway Replacement',
  'driveway-replacement',
  'Full driveway tear-out and replacement with new concrete or asphalt.',
  'Complete driveway replacement including demolition of existing surface, grading and compaction of subbase, forming, pouring, and finishing new concrete (or asphalt paving). Engineered for DFW expansive clay soil with proper thickness, reinforcement, and control joints to minimize cracking.',
  ARRAY['Demolition and haul-off of existing driveway', 'Subgrade preparation and compaction', 'New concrete pour with wire mesh reinforcement', 'Control joint cutting and broom finish', 'Site cleanup and 7-day cure barricading'],
  ARRAY['Driveway widening or extension beyond existing footprint', 'Stamped or decorative concrete finishes (quoted separately)', 'Utility relocation beneath driveway'],
  2, 'onsite_estimate', 4, '{}',
  960, 1920,
  'construction', 2, TRUE, FALSE
);

-- 25. Concrete Leveling
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'driveway-and-walkways'),
  'Concrete Leveling',
  'concrete-leveling',
  'Lift and level sunken concrete slabs on driveways, walkways, and patios.',
  'Polyurethane foam injection (mudjacking alternative) to raise and level sunken concrete slabs. Common in DFW due to expansive clay soil movement. Drills small holes, injects expanding foam beneath the slab, lifts to level, and patches drill holes. Drivable same day. Works on driveways, sidewalks, pool decks, patios, and garage floors.',
  ARRAY['Assess slab settlement and mark injection points', 'Drill small injection holes (penny-sized)', 'Inject polyurethane foam to lift slab to level', 'Patch all drill holes and clean work area', 'Usable within hours of completion'],
  ARRAY['Slab replacement if concrete is severely cracked or broken', 'Foundation repair or pier installation', 'Decorative resurfacing after leveling'],
  2, 'onsite_estimate', 4, '{}',
  240, 480,
  'arrow-up', 3, TRUE, FALSE
);


-- ================================================================
-- CATEGORY 5: Pool & Outdoor Living (5 services)
-- ================================================================

-- 26. Pool Cleaning (Monthly)
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pool-and-outdoor-living'),
  'Pool Cleaning (Monthly)',
  'pool-cleaning-monthly',
  'Monthly pool maintenance to keep your water crystal clear and swim-ready.',
  'Comprehensive monthly pool cleaning and chemical balancing service. Includes skimming surface debris, brushing walls and tile line, vacuuming pool floor, emptying skimmer and pump baskets, testing and adjusting water chemistry, and inspecting equipment for proper operation. Keeps your DFW pool swim-ready year-round.',
  ARRAY['Skim surface and remove floating debris', 'Brush walls, steps, and tile line', 'Vacuum pool floor (manual or automatic)', 'Empty skimmer and pump baskets', 'Test and balance water chemistry (pH, chlorine, alkalinity)'],
  ARRAY['Equipment repair or replacement', 'Acid wash or stain removal', 'Pool draining or refilling', 'Green pool recovery (separate service)'],
  5, 'instant_price', 1, '{"has_pool": true}',
  45, 60,
  'waves', 1, TRUE, TRUE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'pool-cleaning-monthly'), 'Filter Clean', 'Disassemble and deep-clean cartridge or DE filter grids.', 12000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'pool-cleaning-monthly'), 'Salt Cell Inspection', 'Inspect and clean salt chlorinator cell for optimal output.', 7500, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'pool-cleaning-monthly'), 'Phosphate Treatment', 'Apply phosphate remover to prevent algae growth.', 4500, 3, TRUE);

-- 27. Pool Equipment Repair
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pool-and-outdoor-living'),
  'Pool Equipment Repair',
  'pool-equipment-repair',
  'Diagnose and repair pool pumps, filters, heaters, salt cells, and automation systems.',
  'Professional diagnosis and repair of pool and spa equipment. Covers pump motors, variable speed drives, filter assemblies, gas and heat pump heaters, salt chlorinator cells, automation controllers, and plumbing leaks at the equipment pad. Technician carries common parts for same-visit repair when possible.',
  ARRAY['Diagnostic assessment of equipment malfunction', 'Repair or replace faulty component', 'Test full system operation after repair', 'Provide maintenance recommendations'],
  ARRAY['Pool resurfacing or tile replacement', 'Underground plumbing leak detection (separate service)', 'Full equipment pad rebuild or relocation'],
  2, 'onsite_estimate', 4, '{"has_pool": true}',
  60, 240,
  'settings', 2, TRUE, FALSE
);

-- 28. Pool Resurfacing
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pool-and-outdoor-living'),
  'Pool Resurfacing',
  'pool-resurfacing',
  'Refinish your pool interior with plaster, pebble, or quartz for a fresh look and feel.',
  'Complete pool resurfacing including draining, surface preparation, and application of new interior finish. Options include standard white plaster, colored plaster, pebble aggregate (PebbleTec-style), or quartz finish. Includes tile line inspection, coping check, and equipment pad review. Typical DFW pool resurface lasts 10-15 years.',
  ARRAY['Drain pool and prep existing surface', 'Apply new plaster, pebble, or quartz finish', 'Refill pool and balance initial chemistry', 'Start-up chemical treatment program for first 30 days', 'Post-resurface care instructions'],
  ARRAY['Tile line replacement (quoted separately)', 'Coping replacement or repair', 'Structural crack repair or leak detection', 'Pool equipment upgrades'],
  2, 'onsite_estimate', 4, '{"has_pool": true}',
  1440, 2880,
  'paintbrush', 3, TRUE, FALSE
);

-- 29. Pergola Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pool-and-outdoor-living'),
  'Pergola Installation',
  'pergola-installation',
  'Custom or kit pergola to create shade and style in your outdoor living space.',
  'Design and build a freestanding or attached pergola for your patio, deck, or pool area. Options include cedar, treated pine, or aluminum/vinyl kits. Includes post footings, beam and rafter installation, and optional shade fabric or louvered panels. Sized to fit your space and built to handle DFW wind loads.',
  ARRAY['Design consultation for size, style, and placement', 'Post footings with concrete piers', 'Post, beam, and rafter construction', 'Hardware and fastener installation', 'Site cleanup and debris removal'],
  ARRAY['Electrical wiring for fans or lights (see Outdoor Lighting)', 'Motorized louvered roof systems (custom quote)', 'Concrete pad beneath pergola (see Patio Installation)', 'Permit fees if required by municipality'],
  2, 'onsite_estimate', 4, '{}',
  480, 960,
  'tent', 4, TRUE, FALSE
);

INSERT INTO catalog_service_addons (service_id, name, description, suggested_price, display_order, is_active) VALUES
((SELECT id FROM catalog_services WHERE slug = 'pergola-installation'), 'Shade Sail / Fabric Canopy', 'Install retractable or fixed shade fabric between rafters.', 35000, 1, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'pergola-installation'), 'Stain / Paint Finish', 'Apply stain or paint to wood pergola for weather protection and color.', 25000, 2, TRUE),
((SELECT id FROM catalog_services WHERE slug = 'pergola-installation'), 'Ceiling Fan Pre-Wire', 'Run low-voltage wiring for a future ceiling fan installation.', 15000, 3, TRUE);

-- 30. Outdoor Kitchen Installation
INSERT INTO catalog_services (
  category_id, name, slug, short_description, description,
  scope_includes, scope_excludes,
  productizability, pricing_type, launch_wave, homefit_rules,
  estimated_duration_min, estimated_duration_max,
  icon, display_order, is_active, is_featured
) VALUES (
  (SELECT id FROM catalog_categories WHERE slug = 'pool-and-outdoor-living'),
  'Outdoor Kitchen Installation',
  'outdoor-kitchen-installation',
  'Fully custom outdoor kitchen with grill island, countertops, and utilities.',
  'Design-build outdoor kitchen tailored to your space and cooking style. Includes custom island framing (steel stud or block), countertop installation (granite, concrete, or tile), gas line connection for built-in grill, electrical for lighting and outlets, and optional sink with plumbing. Fully permitted and inspected per DFW municipal codes.',
  ARRAY['Design consultation and 3D layout rendering', 'Island framing and weatherproof cladding (stone veneer or stucco)', 'Countertop fabrication and installation', 'Gas line rough-in and connection for grill', 'Electrical for outlets and undercounter lighting'],
  ARRAY['Appliance purchase (grill, fridge, sink sold separately)', 'Covered structure or pergola (see Pergola Installation)', 'Pool or patio construction (separate services)', 'Permit fees (passed through at cost)'],
  1, 'custom', 4, '{}',
  2400, 4800,
  'chef-hat', 5, TRUE, FALSE
);
