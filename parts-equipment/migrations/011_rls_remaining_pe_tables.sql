-- 011_rls_remaining_pe_tables.sql
-- Close the RLS gap on the three pe_* tables that were created after the
-- original RLS sweep (which covered pe_orders, pe_suppliers, pe_validities,
-- pe_warranty_claims, pe_audit_log, pe_install_teams, pe_notifications).
--
-- These three were reachable ANONYMOUSLY: the publishable key is inlined into
-- the browser bundle as NEXT_PUBLIC_SUPABASE_ANON_KEY, and with RLS off
-- PostgREST happily served them. Verified before this migration:
--   GET /rest/v1/pe_user_column_prefs  -> 200, leaked portal_users UUIDs
--   GET /rest/v1/pe_locations          -> 200
--   GET /rest/v1/pe_blocked_reasons    -> 200
-- while RLS-on pe_orders correctly returned 200 [].
--
-- Same pattern as the rest of the app: RLS ON with NO policies. Every read and
-- write goes through Next.js API routes using getServerSupabase(), whose secret
-- key bypasses RLS — so the app is unaffected. The browser only ever uses the
-- publishable key for Realtime broadcast/presence channels (lib/realtime.ts,
-- hooks/useOrders.ts), never for table reads.
--
-- Every reader/writer confirmed to go through getServerSupabase() before applying:
--   pe_user_column_prefs -> app/api/column-prefs/route.ts
--   pe_locations         -> app/api/locations/route.ts + [id]/route.ts
--   pe_blocked_reasons   -> app/api/blocked-reasons/route.ts + [id]/route.ts
-- The Settings pages (/settings/locations, /settings/blocked-reasons) reach these
-- only via those API routes — no page imports the browser client for table reads.

ALTER TABLE pe_user_column_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe_locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe_blocked_reasons   ENABLE ROW LEVEL SECURITY;
