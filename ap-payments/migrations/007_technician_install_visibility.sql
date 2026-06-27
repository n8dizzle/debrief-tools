-- AP Payments: control which technicians appear in the Install Jobs "Add technician"
-- picker, independent of their ServiceTitan business unit. We already sync ALL active
-- technicians into ap_technicians; previously the list was hard-filtered to BU 610
-- (HVAC Install). This flag lets HVAC-Service (or any) techs who pitch in on installs
-- be opted in from Settings → Technician Pay.
--
-- Default false (hidden). Backfill = current Install team (BU 610) stays visible so
-- nothing changes until the user toggles others on.

ALTER TABLE ap_technicians ADD COLUMN IF NOT EXISTS show_in_install BOOLEAN DEFAULT false;

UPDATE ap_technicians
SET show_in_install = true
WHERE business_unit_id = 610;
