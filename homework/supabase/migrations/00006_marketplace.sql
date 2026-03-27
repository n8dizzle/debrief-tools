-- =============================================
-- Migration 00006: Marketplace (Cart, Orders, Transactions)
-- =============================================

-- Shopping cart (persisted)
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES catalog_services(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),

  -- Configuration
  selected_variables JSONB DEFAULT '{}', -- { "variable_id": "selected_value" }
  selected_addons UUID[] DEFAULT '{}', -- addon IDs

  -- Scheduling
  preferred_date DATE,
  preferred_time_slot TEXT, -- 'morning', 'afternoon', 'evening'
  notes TEXT,

  -- Price snapshot at time of cart add
  base_price INTEGER NOT NULL, -- cents
  variable_price_adjustments INTEGER DEFAULT 0, -- cents
  addon_total INTEGER DEFAULT 0, -- cents
  total_price INTEGER NOT NULL, -- cents

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE, -- HW-2026-000001 format
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  home_id UUID NOT NULL REFERENCES homes(id),

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',        -- just placed, awaiting contractor confirmation
      'confirmed',      -- contractor accepted
      'scheduled',      -- date/time confirmed
      'in_progress',    -- work being done
      'completed',      -- work finished
      'cancelled',      -- cancelled by user or contractor
      'refunded',       -- payment refunded
      'disputed'        -- dispute opened
    )),

  -- Pricing
  subtotal INTEGER NOT NULL, -- cents - sum of all items
  platform_fee INTEGER NOT NULL, -- cents - our take
  tax INTEGER DEFAULT 0, -- cents
  total INTEGER NOT NULL, -- cents - what customer pays
  discount INTEGER DEFAULT 0, -- cents

  -- Payment
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  paid_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_date DATE,
  scheduled_time_slot TEXT,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES user_profiles(id),
  cancellation_reason TEXT,

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_home ON orders(home_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_date ON orders(scheduled_date);
CREATE INDEX idx_orders_payment ON orders(stripe_payment_intent_id);

-- Generate order number
CREATE SEQUENCE order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'HW-' ||
    TO_CHAR(NOW(), 'YYYY') || '-' ||
    LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- Order items (line items per service/contractor)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES catalog_services(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),

  -- Configuration snapshot
  service_name TEXT NOT NULL, -- frozen at order time
  selected_variables JSONB DEFAULT '{}',
  selected_addons JSONB DEFAULT '[]', -- [{id, name, price}]

  -- Pricing snapshot
  base_price INTEGER NOT NULL, -- cents
  variable_adjustments INTEGER DEFAULT 0,
  addon_total INTEGER DEFAULT 0,
  line_total INTEGER NOT NULL, -- cents
  platform_fee INTEGER NOT NULL, -- cents
  contractor_payout INTEGER NOT NULL, -- cents

  -- Contractor status
  contractor_status TEXT DEFAULT 'pending'
    CHECK (contractor_status IN ('pending', 'confirmed', 'declined', 'completed')),
  confirmed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Payout
  stripe_transfer_id TEXT,
  payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_contractor ON order_items(contractor_id);
CREATE INDEX idx_order_items_service ON order_items(service_id);

-- Transactions (full audit trail for money movement)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),

  type TEXT NOT NULL CHECK (type IN ('payment', 'platform_fee', 'contractor_payout', 'refund', 'adjustment')),
  amount INTEGER NOT NULL, -- cents (positive for credits, negative for debits)
  currency TEXT DEFAULT 'usd',

  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,

  -- Parties
  from_user_id UUID REFERENCES user_profiles(id),
  to_user_id UUID REFERENCES user_profiles(id),
  to_contractor_id UUID REFERENCES contractors(id),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Updated_at triggers
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Cart: users see their own
CREATE POLICY "Users manage own cart" ON cart_items FOR ALL
  USING (user_id = auth.uid());

-- Orders: users see their own
CREATE POLICY "Users read own orders" ON orders FOR SELECT
  USING (user_id = auth.uid());

-- Contractors see orders assigned to them
CREATE POLICY "Contractors read assigned orders" ON orders FOR SELECT
  USING (
    id IN (
      SELECT order_id FROM order_items
      WHERE contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid())
    )
  );

-- Order items: users see their own order's items
CREATE POLICY "Users read own order items" ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Contractors see their own order items
CREATE POLICY "Contractors read own items" ON order_items FOR SELECT
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Contractors can update their item status
CREATE POLICY "Contractors update own items" ON order_items FOR UPDATE
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Transactions: users see their own
CREATE POLICY "Users read own transactions" ON transactions FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Contractors see their payouts
CREATE POLICY "Contractors read own payouts" ON transactions FOR SELECT
  USING (to_contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Admin full access
CREATE POLICY "Admins manage orders" ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage order items" ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage transactions" ON transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage cart" ON cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
