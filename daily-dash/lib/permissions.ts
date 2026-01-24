/**
 * Permission System for Christmas Air Internal Tools
 *
 * Centralized permission management across all apps:
 * - Daily Dash
 * - Internal Portal
 * - Debrief QA
 * - Future apps (just add new interface)
 *
 * JSONB stored in portal_users.permissions column
 */

// ============================================
// APP-SPECIFIC PERMISSION INTERFACES
// ============================================

export interface DailyDashPermissions {
  can_edit_targets?: boolean;
  can_reply_reviews?: boolean;
  can_edit_huddle_notes?: boolean;
  can_sync_data?: boolean;
}

export interface InternalPortalPermissions {
  can_manage_tools?: boolean;
}

export interface DebriefQAPermissions {
  can_view_all_jobs?: boolean;
}

// Add new apps here - no database migration needed (JSONB handles new keys)
// export interface NewAppPermissions {
//   can_do_thing?: boolean;
// }

// ============================================
// COMBINED PERMISSIONS TYPE
// ============================================

export interface UserPermissions {
  daily_dash?: DailyDashPermissions;
  internal_portal?: InternalPortalPermissions;
  debrief_qa?: DebriefQAPermissions;
  // Add new apps here
}

export type UserRole = 'employee' | 'manager' | 'owner';

// ============================================
// PERMISSION DEFINITIONS (for UI display)
// ============================================

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
}

export interface AppPermissionGroup {
  app: keyof UserPermissions;
  label: string;
  permissions: PermissionDefinition[];
}

export const APP_PERMISSIONS: AppPermissionGroup[] = [
  {
    app: 'daily_dash',
    label: 'Daily Dash',
    permissions: [
      {
        key: 'can_edit_targets',
        label: 'Edit targets',
        description: 'Modify revenue and KPI targets',
      },
      {
        key: 'can_reply_reviews',
        label: 'Reply to reviews',
        description: 'Respond to Google reviews',
      },
      {
        key: 'can_edit_huddle_notes',
        label: 'Edit huddle notes',
        description: 'Add or edit daily huddle notes',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Trigger ServiceTitan and Google Sheets syncs',
      },
    ],
  },
  {
    app: 'internal_portal',
    label: 'Internal Portal',
    permissions: [
      {
        key: 'can_manage_tools',
        label: 'Manage tools',
        description: 'Add, edit, or remove portal tools',
      },
    ],
  },
  {
    app: 'debrief_qa',
    label: 'Debrief QA',
    permissions: [
      {
        key: 'can_view_all_jobs',
        label: 'View all jobs',
        description: 'See jobs from all dispatchers (not just own)',
      },
    ],
  },
];

// ============================================
// PERMISSION CHECK UTILITIES
// ============================================

/**
 * Check if a user has a specific permission.
 *
 * Logic:
 * 1. Owners ALWAYS have all permissions
 * 2. Check for explicit permission override (can grant OR revoke)
 * 3. Fall back to role default (none for non-owners)
 */
export function hasPermission<T extends keyof UserPermissions>(
  role: UserRole,
  permissions: UserPermissions | null | undefined,
  app: T,
  permission: keyof NonNullable<UserPermissions[T]>
): boolean {
  // Owners always have everything
  if (role === 'owner') {
    return true;
  }

  // Check explicit permission (can be true OR false)
  const appPermissions = permissions?.[app];
  if (appPermissions && permission in appPermissions) {
    return (appPermissions as Record<string, boolean>)[permission as string] === true;
  }

  // Default: no permission for non-owners
  return false;
}

/**
 * Get effective permissions for a user (role defaults + overrides).
 * Used by the UI to show what permissions a user actually has.
 */
export function getEffectivePermissions(
  role: UserRole,
  permissions: UserPermissions | null | undefined
): UserPermissions {
  const result: UserPermissions = {};

  for (const group of APP_PERMISSIONS) {
    const app = group.app;
    const appPerms: Record<string, boolean> = {};

    for (const perm of group.permissions) {
      appPerms[perm.key] = hasPermission(
        role,
        permissions,
        app,
        perm.key as keyof NonNullable<UserPermissions[typeof app]>
      );
    }

    (result as Record<string, Record<string, boolean>>)[app] = appPerms;
  }

  return result;
}

/**
 * Check if a permission is explicitly set (not inherited from role).
 * Used by the UI to distinguish between role defaults and explicit overrides.
 */
export function isPermissionExplicit<T extends keyof UserPermissions>(
  permissions: UserPermissions | null | undefined,
  app: T,
  permission: keyof NonNullable<UserPermissions[T]>
): boolean {
  const appPermissions = permissions?.[app];
  if (!appPermissions) return false;
  return permission in appPermissions;
}

/**
 * Get the explicit permission value, or undefined if using role default.
 */
export function getExplicitPermission<T extends keyof UserPermissions>(
  permissions: UserPermissions | null | undefined,
  app: T,
  permission: keyof NonNullable<UserPermissions[T]>
): boolean | undefined {
  const appPermissions = permissions?.[app];
  if (!appPermissions) return undefined;
  if (!(permission in appPermissions)) return undefined;
  return (appPermissions as Record<string, boolean>)[permission as string];
}

// ============================================
// PERMISSION MODIFICATION UTILITIES
// ============================================

/**
 * Set a specific permission for a user.
 * Pass `undefined` to remove the explicit override (use role default).
 */
export function setPermission<T extends keyof UserPermissions>(
  permissions: UserPermissions | null | undefined,
  app: T,
  permission: keyof NonNullable<UserPermissions[T]>,
  value: boolean | undefined
): UserPermissions {
  const result: UserPermissions = { ...(permissions || {}) };

  if (value === undefined) {
    // Remove explicit override
    if (result[app]) {
      const appPerms = { ...result[app] } as Record<string, boolean>;
      delete appPerms[permission as string];
      // Clean up empty app objects
      if (Object.keys(appPerms).length === 0) {
        delete (result as Record<string, unknown>)[app];
      } else {
        (result as Record<string, Record<string, boolean>>)[app] = appPerms;
      }
    }
  } else {
    // Set explicit permission
    if (!result[app]) {
      (result as Record<string, Record<string, boolean>>)[app] = {};
    }
    (result[app] as Record<string, boolean>)[permission as string] = value;
  }

  return result;
}

// ============================================
// HELPER CONSTANTS
// ============================================

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  employee: 'Employee',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full access to all features and settings',
  manager: 'Limited access based on granted permissions',
  employee: 'Limited access based on granted permissions',
};
