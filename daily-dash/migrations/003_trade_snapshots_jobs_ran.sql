-- Add jobs_ran column to trade_daily_snapshots
-- Stores the count of completed jobs per trade/department per day
-- Used by scorecard sync to compute weekly jobs_ran and avg_ticket
ALTER TABLE trade_daily_snapshots ADD COLUMN IF NOT EXISTS jobs_ran int DEFAULT 0;
