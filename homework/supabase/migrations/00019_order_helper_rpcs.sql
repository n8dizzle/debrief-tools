-- Make contractor_id nullable on order_items for platform orders (no contractors onboarded yet)
ALTER TABLE order_items ALTER COLUMN contractor_id DROP NOT NULL;

-- RPC: Copy stages from a template (by slug) to an order
CREATE OR REPLACE FUNCTION copy_template_stages_to_order(
  p_order_id uuid,
  p_template_slug text
) RETURNS void AS $$
INSERT INTO order_stages (order_id, template_item_id, name, description, display_order, status)
SELECT p_order_id, sti.id, sti.name, sti.description, sti.display_order,
  CASE WHEN sti.display_order = 0 THEN 'in_progress' ELSE 'pending' END
FROM stage_template_items sti
JOIN stage_templates st ON st.id = sti.template_id
WHERE st.slug = p_template_slug
ORDER BY sti.display_order;
$$ LANGUAGE sql;
