// Domain types for the inventory system. These mirror the Express API responses.

export type Department = 'plumbing' | 'hvac' | 'office';
export type UserRole = 'admin' | 'warehouse_manager' | 'warehouse_staff' | 'technician' | 'office_staff' | 'it_admin';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: Department | null;
  is_active: boolean;
  st_technician_id?: string | null;
  phone?: string | null;
  home_warehouse_id?: string | null;
  assigned_truck_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  status: string;
}

export interface Truck {
  id: string;
  truck_number: string;
  department: Department;
  home_warehouse_id: string;
  status: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
}

export interface Material {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit_cost: number | string | null;
  unit_of_measure?: string | null;
  category?: string | null;
  department: Department;
  is_active: boolean;
  st_pricebook_id?: string | null;
  reorder_point?: number | null;
  reorder_quantity?: number | null;
  max_stock?: number | null;
  barcode?: string | null;
  primary_supply_house_id?: string | null;
  secondary_supply_house_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface ListResponse<T> {
  items?: T[];
  materials?: T[];
  trucks?: T[];
  warehouses?: T[];
  total?: number;
}
