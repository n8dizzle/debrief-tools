-- 009_location_physical_only.sql
-- Completes the location/stage split started in 008.
--
-- `location` was the team's live single source of truth (one dropdown that
-- conflated physical place, pipeline status, and parked reason). 008 added the
-- clean columns and backfilled INSTALL only. This migration:
--
--   1. Re-derives `stage` + `blocked` from the CURRENT location value for ALL rows
--      (install + service). We re-derive rather than trust 008's backfill because
--      the team kept editing `location` after 008 ran, so it — not the stale
--      derived columns — is the truth.
--   2. Strips every non-physical value out of `location`, leaving only real places
--      ('Lewisville Shop', 'Supply House') or NULL. From here on the app writes
--      stage/blocked directly and location holds a physical place only.
--
-- DEPLOY IN LOCKSTEP with the app code that reads stage/blocked. Running this while
-- the old code is live would blank the team's Location dropdown / dashboard.

UPDATE pe_orders SET
  stage = CASE
    WHEN location = 'Place Order' AND COALESCE(order_num,'') <> '' THEN 'ordered'
    WHEN location = 'Place Order'          THEN 'needs_order'
    WHEN location = 'Shipping to Shop'     THEN 'inbound'
    WHEN location = 'P/U Supply House'     THEN 'inbound'
    WHEN location = 'Lewisville Shop'      THEN 'staged'
    WHEN location = 'Backordered'          THEN 'ordered'
    WHEN location = 'Shipping to Supplier' THEN 'ordered'
    WHEN location = 'Cancel PO'            THEN 'cancelled'
    WHEN location = 'Completed'            THEN 'done'
    -- 'Waiting for Customer/Tech', 'Duct Cleaning - Schedule', blank: no pipeline
    -- position was ever encoded, so fall back to a sane default.
    ELSE COALESCE(NULLIF(stage, ''), 'needs_order')
  END,
  blocked = CASE
    WHEN location = 'Backordered'                                   THEN 'backordered'
    WHEN location = 'Shipping to Supplier'                          THEN 'shipping_to_supplier'
    WHEN location IN ('Waiting for Customer', 'Waiting for Tech/Cus') THEN 'waiting_customer'
    -- A row could only ever hold ONE dropdown value, so any physical/other value
    -- means there was no block. Safe to clear.
    ELSE ''
  END,
  location = CASE
    WHEN location = 'Lewisville Shop'  THEN 'Lewisville Shop'
    WHEN location = 'P/U Supply House' THEN 'Supply House'
    ELSE NULL
  END;
