-- Parallel storage for ServiceTitan Booking IDs alongside existing Lead IDs.
--
-- A referral produces EITHER a ST lead OR a ST booking, never both, depending
-- on which ref_settings key the admin has populated:
--
--   st_referral_campaign_id set, booking_provider_id unset  → lead path
--   st_referral_booking_provider_id set                      → booking path
--
-- Bookings are the preferred path for warm referrals (referrer already vouched
-- for us — the friend is closer to "ready to schedule" than "qualify me").
-- Kept as its own column rather than overloading service_titan_lead_id so
-- deep-link URLs, reports, and queue-specific surfacing stay clean.

ALTER TABLE ref_referrals
  ADD COLUMN IF NOT EXISTS service_titan_booking_id TEXT;
