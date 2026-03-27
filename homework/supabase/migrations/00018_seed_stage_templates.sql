-- Seed default stage templates for common service categories

INSERT INTO stage_templates (name, slug, description, service_category, is_default) VALUES
  ('HVAC Installation', 'hvac-install', 'Standard HVAC system installation workflow', 'hvac', true),
  ('HVAC Repair', 'hvac-repair', 'Standard HVAC repair workflow', 'hvac', false),
  ('General Service', 'general-service', 'Generic home service workflow', null, true);

-- HVAC Installation stages
INSERT INTO stage_template_items (template_id, name, description, display_order, estimated_duration_hours, notify_customer)
SELECT t.id, v.name, v.description, v.display_order, v.estimated_duration_hours, v.notify_customer
FROM stage_templates t
CROSS JOIN (
  SELECT 'Order Confirmed'::text AS name, 'Your order has been confirmed and assigned to a professional.'::text AS description, 0 AS display_order, NULL::integer AS estimated_duration_hours, true AS notify_customer
  UNION ALL SELECT 'Pre-Install Survey', 'A technician will visit to verify measurements and plan the installation.', 1, 2, true
  UNION ALL SELECT 'Equipment Ordered', 'Your new equipment has been ordered from the manufacturer.', 2, NULL, true
  UNION ALL SELECT 'Installation Day', 'The installation team is on-site performing the work.', 3, 8, true
  UNION ALL SELECT 'System Testing', 'Running performance tests to ensure everything works properly.', 4, 2, true
  UNION ALL SELECT 'Final Inspection', 'Final walkthrough and quality check.', 5, 1, true
  UNION ALL SELECT 'Complete', 'Your installation is complete. Enjoy your new system.', 6, NULL, true
) v
WHERE t.slug = 'hvac-install';

-- HVAC Repair stages
INSERT INTO stage_template_items (template_id, name, description, display_order, estimated_duration_hours, notify_customer)
SELECT t.id, v.name, v.description, v.display_order, v.estimated_duration_hours, v.notify_customer
FROM stage_templates t
CROSS JOIN (
  SELECT 'Order Confirmed'::text AS name, 'Your repair has been scheduled.'::text AS description, 0 AS display_order, NULL::integer AS estimated_duration_hours, true AS notify_customer
  UNION ALL SELECT 'Diagnosis', 'The technician is diagnosing the issue.', 1, 2, true
  UNION ALL SELECT 'Repair in Progress', 'Repair work is underway.', 2, 4, true
  UNION ALL SELECT 'Testing', 'Verifying the repair resolved the issue.', 3, 1, true
  UNION ALL SELECT 'Complete', 'Your repair is complete.', 4, NULL, true
) v
WHERE t.slug = 'hvac-repair';

-- General Service stages
INSERT INTO stage_template_items (template_id, name, description, display_order, estimated_duration_hours, notify_customer)
SELECT t.id, v.name, v.description, v.display_order, v.estimated_duration_hours, v.notify_customer
FROM stage_templates t
CROSS JOIN (
  SELECT 'Order Confirmed'::text AS name, 'Your service has been confirmed.'::text AS description, 0 AS display_order, NULL::integer AS estimated_duration_hours, true AS notify_customer
  UNION ALL SELECT 'Professional En Route', 'Your professional is on the way.', 1, NULL, true
  UNION ALL SELECT 'Work in Progress', 'The work is underway.', 2, NULL, true
  UNION ALL SELECT 'Complete', 'Your service is complete.', 3, NULL, true
) v
WHERE t.slug = 'general-service';
