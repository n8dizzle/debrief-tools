-- =============================================
-- Migration 00008: Supporting Tables
-- =============================================
-- Notifications, activity log, memberships, Price Book

-- Notifications (multi-channel)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'order_placed', 'order_confirmed', 'order_scheduled',
    'order_completed', 'order_cancelled',
    'payment_received', 'payout_sent',
    'review_requested', 'review_received',
    'contractor_approved', 'contractor_rejected',
    'system', 'marketing'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  reference_id UUID, -- order_id, review_id, etc.
  reference_type TEXT, -- 'order', 'review', 'contractor', etc.
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);

-- Activity log (full audit trail)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'order', 'contractor', 'service', 'review', etc.
  entity_id UUID,
  changes JSONB, -- { field: { old: x, new: y } }
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- Homeowner memberships (free/paid tiers)
CREATE TABLE homeowner_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'premium')),
  -- free = browse only
  -- starter = $195 one-time (onboarding + home profile)
  -- premium = $9.99/mo (priority, discounts, concierge)
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memberships_user ON homeowner_memberships(user_id);
CREATE INDEX idx_memberships_tier ON homeowner_memberships(tier);

-- Price Book: Supplier Lists (for Price Book SaaS tool)
CREATE TABLE pricebook_supplier_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  file_url TEXT, -- uploaded PDF
  file_name TEXT,
  parse_status TEXT DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_at TIMESTAMPTZ,
  item_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricebook_lists_contractor ON pricebook_supplier_lists(contractor_id);

-- Price Book: Parsed Items
CREATE TABLE pricebook_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_list_id UUID NOT NULL REFERENCES pricebook_supplier_lists(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,

  -- Parsed data
  part_number TEXT,
  description TEXT NOT NULL,
  category TEXT,
  supplier_cost INTEGER NOT NULL, -- cents
  unit TEXT DEFAULT 'each',

  -- Contractor markups
  markup_percent NUMERIC(5,2),
  retail_price INTEGER, -- cents

  -- Catalog mapping
  mapped_service_id UUID REFERENCES catalog_services(id),
  mapping_confidence NUMERIC(3,2), -- 0-1 AI confidence score
  mapping_status TEXT DEFAULT 'unmapped'
    CHECK (mapping_status IN ('unmapped', 'suggested', 'confirmed', 'rejected')),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricebook_items_list ON pricebook_items(supplier_list_id);
CREATE INDEX idx_pricebook_items_contractor ON pricebook_items(contractor_id);
CREATE INDEX idx_pricebook_items_mapping ON pricebook_items(mapping_status);

-- Updated_at triggers
CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON homeowner_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pricebook_lists_updated_at
  BEFORE UPDATE ON pricebook_supplier_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pricebook_items_updated_at
  BEFORE UPDATE ON pricebook_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricebook_supplier_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricebook_items ENABLE ROW LEVEL SECURITY;

-- Notifications: users see their own
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Activity log: admins only
CREATE POLICY "Admins read activity log" ON activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Insert allowed for all authenticated (server-side writes)
CREATE POLICY "Authenticated insert activity" ON activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Memberships: users see their own
CREATE POLICY "Users manage own membership" ON homeowner_memberships FOR ALL
  USING (user_id = auth.uid());

-- Price Book: contractors manage their own
CREATE POLICY "Contractors manage own supplier lists" ON pricebook_supplier_lists FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

CREATE POLICY "Contractors manage own pricebook items" ON pricebook_items FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Admin full access on all
CREATE POLICY "Admins manage notifications" ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage memberships" ON homeowner_memberships FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage supplier lists" ON pricebook_supplier_lists FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage pricebook items" ON pricebook_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
