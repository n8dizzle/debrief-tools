-- Expand dash_monthly_targets to support avg_ticket and sales target types
ALTER TABLE dash_monthly_targets DROP CONSTRAINT IF EXISTS dash_monthly_targets_target_type_check;
ALTER TABLE dash_monthly_targets ADD CONSTRAINT dash_monthly_targets_target_type_check
  CHECK (target_type = ANY (ARRAY['revenue', 'jobs', 'avg_ticket', 'sales']));
