-- Weekly Scorecard table for L10 meetings
-- Stores weekly aggregated metrics by trade/department
-- Historical data imported from spreadsheets, future data auto-synced

CREATE TABLE IF NOT EXISTS weekly_scorecard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  week_number int NOT NULL,
  week_ending date NOT NULL,

  -- Scope
  trade text NOT NULL,           -- 'company', 'hvac', 'plumbing'
  department text,               -- null (trade total), 'install', 'service', 'maintenance', 'sales'

  -- Revenue & Sales
  revenue numeric DEFAULT 0,
  completed_revenue numeric DEFAULT 0,
  non_job_revenue numeric DEFAULT 0,
  adj_revenue numeric DEFAULT 0,
  sales numeric DEFAULT 0,
  sold_estimates int DEFAULT 0,
  avg_sale numeric DEFAULT 0,
  avg_ticket numeric DEFAULT 0,
  jobs_ran int DEFAULT 0,

  -- HVAC-specific (only for hvac trade rows)
  warranty_jobs int DEFAULT 0,
  recall_jobs int DEFAULT 0,
  zero_dollar_tickets int DEFAULT 0,
  zero_dollar_pct numeric DEFAULT 0,
  tgls int DEFAULT 0,
  tgl_sales numeric DEFAULT 0,
  tgl_avg_sale numeric DEFAULT 0,
  tgl_close_rate numeric DEFAULT 0,

  -- HVAC Sales pipeline (only for hvac/sales department)
  hvac_leads int DEFAULT 0,
  hvac_lead_sales numeric DEFAULT 0,
  appts_booked int DEFAULT 0,
  appts_ran int DEFAULT 0,
  close_rate numeric DEFAULT 0,
  marketed_leads int DEFAULT 0,
  marketed_lead_sales numeric DEFAULT 0,

  -- Memberships (only for company-level rows)
  memberships_total int,
  memberships_sold int,
  memberships_renewed int,
  memberships_expired int,
  memberships_cancelled int,
  memberships_suspended int,
  memberships_deleted int,
  memberships_reactivated int,
  memberships_active_end int,

  -- Growth (only for company-level rows)
  total_leads int,
  new_customers int,
  new_customer_revenue numeric,

  -- Reviews (only for company-level rows)
  reviews_count int,
  reviews_pct numeric,
  reviews_avg_rating numeric,

  -- Calls (only for company-level rows)
  total_calls int,
  outbound_calls int,
  inbound_calls int,
  phone_leads int,
  booked_from_inbound int,
  total_jobs_booked int,
  total_cancellations int,
  net_bookings int,

  -- Metadata
  data_source text DEFAULT 'sync',  -- 'sync', 'import', 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(year, week_number, trade, department)
);

-- Index for common queries
CREATE INDEX idx_weekly_scorecard_year_week ON weekly_scorecard(year, week_number);
CREATE INDEX idx_weekly_scorecard_week_ending ON weekly_scorecard(week_ending);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_scorecard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_scorecard_updated_at
  BEFORE UPDATE ON weekly_scorecard
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_scorecard_updated_at();
