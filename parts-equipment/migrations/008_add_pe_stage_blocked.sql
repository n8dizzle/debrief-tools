-- 008_add_pe_stage_blocked.sql
-- Untangle the location/stage conflation. `location` had been overloaded with BOTH
-- physical place AND pipeline status. Split into two clean, orthogonal fields:
--
--   stage    (fulfillment pipeline):  needs_order → ordered → inbound → staged → done → cancelled
--   blocked  (parked reason, orthogonal): '' | backordered | waiting_customer
--
-- `location` is retained for physical place only (e.g. Lewisville Shop, supply house).
--
-- Backfill is INSTALL-ONLY. Service rows keep the default 'needs_order' until the
-- service board is built (their stage is unused until then). We backfill from
-- `location` + `order_num` — the two fields the team actually keeps honest. The
-- parts_ordered / bo_ordered booleans are unreliable (parts_ordered ~never set;
-- bo_ordered set on most rows regardless of real backorder) and are intentionally ignored.

ALTER TABLE pe_orders ADD COLUMN IF NOT EXISTS stage   TEXT NOT NULL DEFAULT 'needs_order';
ALTER TABLE pe_orders ADD COLUMN IF NOT EXISTS blocked TEXT NOT NULL DEFAULT '';

UPDATE pe_orders SET
  stage = CASE
    WHEN location = 'Place Order'         AND COALESCE(order_num,'') <> '' THEN 'ordered'
    WHEN location = 'Place Order'          THEN 'needs_order'
    WHEN location = 'Shipping to Shop'     THEN 'inbound'
    WHEN location = 'P/U Supply House'     THEN 'inbound'
    WHEN location = 'Lewisville Shop'      THEN 'staged'
    WHEN location = 'Backordered'          THEN 'ordered'
    WHEN location = 'Shipping to Supplier' THEN 'ordered'
    WHEN location = 'Cancel PO'            THEN 'cancelled'
    ELSE 'needs_order'
  END,
  blocked = CASE
    WHEN location IN ('Backordered','Shipping to Supplier') THEN 'backordered'
    WHEN location = 'Waiting for Customer'                  THEN 'waiting_customer'
    ELSE ''
  END
WHERE order_type = 'install';

CREATE INDEX IF NOT EXISTS pe_orders_stage_idx ON pe_orders(stage);
