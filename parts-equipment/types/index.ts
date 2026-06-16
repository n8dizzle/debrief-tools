export type PEOrderStatus = 'open' | 'completed' | 'cancelled';
export type PEOrderType = 'service' | 'install';

export interface PEOrder {
  id: number;
  date: string | null;
  job: string | null;
  tech: string | null;
  customer: string | null;
  order_type: PEOrderType;
  subtype: string | null;
  warranty: string | null;
  warranty_type: string | null;
  part: string | null;
  supplier: string | null;
  order_num: string | null;
  cost: string | null;
  estimate_cost: string | null;
  location: string | null;
  owner: string | null;
  eta: string | null;
  scheduled_date: string | null;
  note_wh: string | null;
  note_cxr: string | null;
  status: PEOrderStatus;
  is_equipment: boolean;
  cancel_source: string | null;
  bo_notified: boolean;
  bo_notified_date: string | null;
  completed_by: string | null;
  completed_at: string | null;
  linked_jobs: string[];
  st_url: string | null;
  // Install-only fields
  install_team: string | null;
  sub_rate: string | null;
  equip_cost: string | null;
  sched_date: string | null;
  call_booked: boolean;
  job_cost: string | null;
  equip_avail: string | null;
  bo_ordered: boolean;
  bo_status: string | null;
  // Checkbox fields
  parts_ordered: boolean;
  part_bo: boolean;
  bo_informed: boolean;
  parts_at_shop: boolean;
  two_techs: boolean;
  qc_scheduled: boolean;
  qc_date: string | null;
  tracking: string | null;
  tech_type: string | null;
  cancel_reason: string | null;
  needs_order: boolean;
  multiple_estimates: boolean;
  estimates: string | null;
  created_at: string;
  updated_at: string;
}

export interface PEWarrantyClaim {
  id: number;
  last_name: string | null;
  mfgr: string | null;
  fail_date: string | null;
  repair_date: string | null;
  main_model_num: string | null;
  main_unit_sn: string | null;
  failed_part_num: string | null;
  failed_part_serial: string | null;
  mfg_invoice_num: string | null;
  repl_part_num: string | null;
  repl_part_serial: string | null;
  date_of_claim: string | null;
  claim_num: string | null;
  credit_approved: string | null;
  return_required: string | null;
  amt_charged: string | null;
  amt_refunded: string | null;
  paid: string | null;
  created_at: string;
  updated_at: string;
}

export interface PEAuditLog {
  id: number;
  type: string | null;
  job_id: string | null;
  customer: string | null;
  action: string | null;
  detail: string | null;
  changed_by: string | null;
  created_at: string;
}
