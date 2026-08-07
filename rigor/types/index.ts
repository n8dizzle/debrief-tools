export interface WorkItem {
  id: number;
  process: string;
  source: string;
  source_id: string;
  step: string;
  owner_role: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  data: PartsData;
  created_at: string;
  updated_at: string;
}

/** Process-specific fields for `process = 'parts'`. */
export interface PartsData {
  job?: string;
  customer?: string;
  sku?: string;
  description?: string;
  qty?: number;
  unit_cost?: number;
  estimate_id?: number;
  estimate_name?: string;
  sold_on?: string;
  st_url?: string;
  supplier?: string;
  order_num?: string;
  eta?: string;
}

export interface WorkEvent {
  id: number;
  work_item_id: number;
  at: string;
  actor: string;
  kind: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
}
