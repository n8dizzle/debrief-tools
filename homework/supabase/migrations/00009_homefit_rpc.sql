-- =============================================
-- Migration 00009: HomeFit Engine (RPC Function)
-- =============================================
-- Evaluates home profile against service homefit_rules
-- Returns only services relevant to a specific home

-- HomeFit matching function
CREATE OR REPLACE FUNCTION get_homefit_services(
  p_home_id UUID,
  p_department_slug TEXT DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_wave_max INTEGER DEFAULT 4
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_slug TEXT,
  short_description TEXT,
  category_name TEXT,
  category_slug TEXT,
  department_name TEXT,
  department_slug TEXT,
  pricing_type TEXT,
  productizability INTEGER,
  launch_wave INTEGER,
  estimated_duration_min INTEGER,
  estimated_duration_max INTEGER,
  icon TEXT,
  image_url TEXT,
  homefit_score NUMERIC -- 1.0 = perfect match, 0.5 = partial, 0 = not relevant
) AS $$
DECLARE
  v_features RECORD;
  v_home RECORD;
  v_systems JSONB;
BEGIN
  -- Get home data
  SELECT * INTO v_home FROM homes WHERE id = p_home_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Home not found: %', p_home_id;
  END IF;

  -- Get home features
  SELECT * INTO v_features FROM home_features WHERE home_id = p_home_id;

  -- Get home systems as JSONB array
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'system_type', hs.system_type,
    'fuel_type', hs.fuel_type,
    'capacity', hs.capacity
  )), '[]'::jsonb) INTO v_systems
  FROM home_systems hs WHERE hs.home_id = p_home_id;

  RETURN QUERY
  SELECT
    cs.id as service_id,
    cs.name as service_name,
    cs.slug as service_slug,
    cs.short_description,
    cc.name as category_name,
    cc.slug as category_slug,
    cd.name as department_name,
    cd.slug as department_slug,
    cs.pricing_type,
    cs.productizability,
    cs.launch_wave,
    cs.estimated_duration_min,
    cs.estimated_duration_max,
    cs.icon,
    cs.image_url,
    -- Calculate HomeFit score
    CASE
      -- No rules = always relevant (score 1.0)
      WHEN cs.homefit_rules IS NULL OR cs.homefit_rules = '{}'::jsonb THEN 1.0

      -- Evaluate rules
      ELSE (
        SELECT COALESCE(
          -- Count matching rules / total rules
          SUM(CASE
            -- Boolean feature checks
            WHEN key = 'has_pool' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_pool = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_sprinkler_system' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_sprinkler_system = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_fence' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_fence = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_gas_line' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_gas_line = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_central_hvac' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_central_hvac = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_ductwork' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_ductwork = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_mini_split' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_mini_split = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_tankless_water_heater' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_tankless_water_heater = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_gutters' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_gutters = (value::text)::boolean THEN 1 ELSE 0 END
            WHEN key = 'has_outdoor_kitchen' AND v_features IS NOT NULL
              THEN CASE WHEN v_features.has_outdoor_kitchen = (value::text)::boolean THEN 1 ELSE 0 END

            -- Numeric range checks
            WHEN key = 'sqft_min' AND v_home.sqft IS NOT NULL
              THEN CASE WHEN v_home.sqft >= (value::text)::integer THEN 1 ELSE 0 END
            WHEN key = 'sqft_max' AND v_home.sqft IS NOT NULL
              THEN CASE WHEN v_home.sqft <= (value::text)::integer THEN 1 ELSE 0 END
            WHEN key = 'year_built_before' AND v_home.year_built IS NOT NULL
              THEN CASE WHEN v_home.year_built < (value::text)::integer THEN 1 ELSE 0 END
            WHEN key = 'year_built_after' AND v_home.year_built IS NOT NULL
              THEN CASE WHEN v_home.year_built >= (value::text)::integer THEN 1 ELSE 0 END
            WHEN key = 'stories_min' AND v_home.stories IS NOT NULL
              THEN CASE WHEN v_home.stories >= (value::text)::integer THEN 1 ELSE 0 END

            -- String match checks
            WHEN key = 'foundation_type' AND v_home.foundation_type IS NOT NULL
              THEN CASE WHEN v_home.foundation_type = value::text THEN 1 ELSE 0 END
            WHEN key = 'property_type' AND v_home.property_type IS NOT NULL
              THEN CASE WHEN v_home.property_type = value::text THEN 1 ELSE 0 END
            WHEN key = 'exterior_type' AND v_home.exterior_type IS NOT NULL
              THEN CASE WHEN v_home.exterior_type = value::text THEN 1 ELSE 0 END
            WHEN key = 'fence_material' AND v_features IS NOT NULL AND v_features.fence_material IS NOT NULL
              THEN CASE WHEN v_features.fence_material = value::text THEN 1 ELSE 0 END

            -- Unknown rule = neutral (don't penalize for missing home data)
            ELSE 0.5
          END)::numeric / COUNT(*)::numeric,
          0.5 -- default if no rules evaluated
        )
        FROM jsonb_each(cs.homefit_rules)
      )
    END as homefit_score

  FROM catalog_services cs
  JOIN catalog_categories cc ON cs.category_id = cc.id
  JOIN catalog_departments cd ON cc.department_id = cd.id
  WHERE cs.is_active = TRUE
    AND cs.launch_wave <= p_wave_max
    AND (p_department_slug IS NULL OR cd.slug = p_department_slug)
    AND (p_category_slug IS NULL OR cc.slug = p_category_slug)
    AND (p_search_query IS NULL OR cs.search_vector @@ plainto_tsquery('english', p_search_query))
  ORDER BY homefit_score DESC, cs.display_order, cs.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get contractor prices for a service in a zip code
CREATE OR REPLACE FUNCTION get_service_contractors(
  p_service_id UUID,
  p_zip_code TEXT
)
RETURNS TABLE (
  contractor_id UUID,
  business_name TEXT,
  logo_url TEXT,
  rating_overall NUMERIC,
  review_count INTEGER,
  jobs_completed INTEGER,
  base_price INTEGER,
  variable_pricing JSONB,
  addon_pricing JSONB,
  verification_status TEXT,
  member_since TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as contractor_id,
    c.business_name,
    c.logo_url,
    c.rating_overall,
    c.review_count,
    c.jobs_completed,
    cp.base_price,
    cp.variable_pricing,
    cp.addon_pricing,
    c.verification_status,
    c.member_since
  FROM contractors c
  JOIN contractor_prices cp ON cp.contractor_id = c.id AND cp.service_id = p_service_id AND cp.is_active = TRUE
  JOIN contractor_service_areas csa ON csa.contractor_id = c.id AND csa.zip_code = p_zip_code AND csa.is_active = TRUE
  WHERE c.verification_status = 'approved'
    AND c.is_active = TRUE
    AND c.stripe_charges_enabled = TRUE
  ORDER BY c.rating_overall DESC, cp.base_price ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check contractor availability for a date
CREATE OR REPLACE FUNCTION check_contractor_availability(
  p_contractor_id UUID,
  p_date DATE
)
RETURNS TABLE (
  is_available BOOLEAN,
  start_time TIME,
  end_time TIME,
  booked_count INTEGER,
  max_bookings INTEGER,
  remaining_slots INTEGER
) AS $$
DECLARE
  v_dow INTEGER;
  v_blocked BOOLEAN;
  v_avail RECORD;
  v_capacity INTEGER;
  v_booked INTEGER;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date)::INTEGER;

  -- Check if date is blocked
  SELECT EXISTS(
    SELECT 1 FROM contractor_blocked_dates
    WHERE contractor_id = p_contractor_id AND blocked_date = p_date
  ) INTO v_blocked;

  IF v_blocked THEN
    RETURN QUERY SELECT FALSE, NULL::TIME, NULL::TIME, 0, 0, 0;
    RETURN;
  END IF;

  -- Get availability for day of week
  SELECT * INTO v_avail
  FROM contractor_availability
  WHERE contractor_id = p_contractor_id AND day_of_week = v_dow;

  IF NOT FOUND OR NOT v_avail.is_available THEN
    RETURN QUERY SELECT FALSE, NULL::TIME, NULL::TIME, 0, 0, 0;
    RETURN;
  END IF;

  -- Get daily capacity
  SELECT COALESCE(cdc.max_bookings, 4) INTO v_capacity
  FROM contractor_daily_capacity cdc
  WHERE cdc.contractor_id = p_contractor_id AND cdc.day_of_week = v_dow;

  IF NOT FOUND THEN v_capacity := 4; END IF;

  -- Count existing bookings
  SELECT COUNT(*) INTO v_booked
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.contractor_id = p_contractor_id
    AND o.scheduled_date = p_date
    AND o.status NOT IN ('cancelled', 'refunded');

  RETURN QUERY SELECT
    (v_booked < v_capacity) as is_available,
    v_avail.start_time,
    v_avail.end_time,
    v_booked as booked_count,
    v_capacity as max_bookings,
    (v_capacity - v_booked) as remaining_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
