ALTER TABLE ref_referrers ADD COLUMN IF NOT EXISTS referrer_type TEXT CHECK (referrer_type IN ('EMPLOYEE', 'CUSTOMER'));
