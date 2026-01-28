-- Slack notification settings
CREATE TABLE IF NOT EXISTS ar_slack_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (ignore if already exist)
INSERT INTO ar_slack_settings (setting_key, setting_value) VALUES
  ('weekly_slack_enabled', 'false'),
  ('weekly_slack_day', '1'),
  ('weekly_slack_hour', '6'),
  ('slack_webhook_url', '')
ON CONFLICT (setting_key) DO NOTHING;

-- Track sent notifications
CREATE TABLE IF NOT EXISTS ar_slack_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT,
  error_message TEXT
);

-- Create indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_ar_slack_notifications_log_type ON ar_slack_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_ar_slack_notifications_log_sent ON ar_slack_notifications_log(sent_at DESC);
