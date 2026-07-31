-- 003: audit log for technician self-view magic links (pilot visibility).
CREATE TABLE IF NOT EXISTS hr_journey_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_technician_id  BIGINT NOT NULL,
  ladder_id         UUID,
  sent_by           UUID,           -- portal_users.id (the manager)
  phone_last4       TEXT,
  channel           TEXT,           -- 'sms'
  message_id        TEXT,           -- Quo message id
  ok                BOOLEAN NOT NULL DEFAULT true,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_journey_links_tech ON hr_journey_links(st_technician_id);
