-- Phase 0 deliverability spike (THROWAWAY).
-- Measures: does an SMS link reach a tech's phone, do they tap it, do they finish?
-- This is NOT part of the train_* schema. Drop the whole table after the spike:
--   DROP TABLE IF EXISTS spike_taps;

CREATE TABLE IF NOT EXISTS spike_taps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token            text UNIQUE NOT NULL,
  tech_name        text,
  phone            text,                       -- E.164
  sent_at          timestamptz,
  send_status      text,                       -- 'accepted' | 'failed'
  send_error       text,
  provider_msg_id  text,
  tapped_at        timestamptz,                -- first tap
  tap_count        integer NOT NULL DEFAULT 0,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spike_taps_token_idx ON spike_taps (token);
