/**
 * Shared types for Christmas Air Internal Tools
 */

import type { UserPermissions, UserRole } from './permissions';

// ============================================
// USER TYPES
// ============================================

export interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at?: string;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string | null;
  department_id: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string | null;
  permissions: UserPermissions | null;
  // Joined data
  department?: Department;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export type AuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'permission.changed'
  | 'role.changed';

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  target_type: 'user' | 'permission';
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  // Joined data
  actor?: PortalUser;
  target_user?: PortalUser;
}

// ============================================
// SESSION TYPES (for Python SSO)
// ============================================

export interface SessionValidationRequest {
  sessionToken: string;
}

export interface SessionValidationResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    permissions: UserPermissions | null;
    department_id: string | null;
  };
  error?: string;
}

// ============================================
// NEXT-AUTH TYPE EXTENSIONS
// ============================================

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      departmentId: string | null;
      department: Department | null;
      isActive: boolean;
      permissions: UserPermissions | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: UserRole;
    departmentId?: string | null;
    department?: Department | null;
    isActive?: boolean;
    permissions?: UserPermissions | null;
  }
}
