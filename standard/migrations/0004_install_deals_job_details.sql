-- Downstream stage data pulled straight from ServiceTitan into the deal, so deal
-- detail no longer needs ap_install_jobs. scheduled from the install job's first
-- appointment; invoice number/date/balance/total from ST accounting.
alter table install_deals
  add column if not exists sold_by_name    text,
  add column if not exists scheduled_date  date,
  add column if not exists invoice_number  text,
  add column if not exists invoice_date    date,
  add column if not exists invoice_balance numeric,
  add column if not exists invoice_total   numeric;
