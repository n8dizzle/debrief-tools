-- Stage-level gate answer for conditional stages (Permit, Inspection): a row keyed by the
-- STAGE node carries state = 'required' | 'not_required'. Regular sub-step rows keep using
-- `done`. 'not_required' closes the stage as N/A without implying work was done.
alter table install_deal_steps add column if not exists state text;
