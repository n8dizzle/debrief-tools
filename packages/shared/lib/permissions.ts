/**
 * Permission System for Christmas Air Internal Tools
 *
 * Centralized permission management across all apps:
 * - Daily Dash
 * - Internal Portal
 * - Debrief QA
 * - Marketing Hub
 * - Admin Panel
 * - AR Collections
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
  can_manage_users?: boolean;
  can_manage_spot_checks?: boolean;
}

export interface MarketingHubPermissions {
  can_manage_gbp_posts?: boolean;
  can_view_analytics?: boolean;
  can_view_social?: boolean;
  can_manage_tasks?: boolean;
  can_sync_data?: boolean;
}

export interface AdminPanelPermissions {
  can_manage_users?: boolean;
  can_view_audit_log?: boolean;
}

export interface ARCollectionsPermissions {
  can_view_ar_dashboard?: boolean;
  can_manage_collections?: boolean;
  can_export_reports?: boolean;
  can_write_off_accounts?: boolean;
}

export interface JobTrackerPermissions {
  can_view_trackers?: boolean;
  can_manage_trackers?: boolean;
  can_manage_templates?: boolean;
  can_sync_data?: boolean;
}

// ============================================
// COMBINED PERMISSIONS TYPE
// ============================================

export interface UserPermissions {
  daily_dash?: DailyDashPermissions;
  internal_portal?: InternalPortalPermissions;
  debrief_qa?: DebriefQAPermissions;
  marketing_hub?: MarketingHubPermissions;
  admin_panel?: AdminPanelPermissions;
  ar_collections?: ARCollectionsPermissions;
  job_tracker?: JobTrackerPermissions;
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
    app: 'marketing_hub',
    label: 'Marketing Hub',
    permissions: [
      {
        key: 'can_manage_gbp_posts',
        label: 'Manage GBP posts',
        description: 'Create and publish Google Business Profile posts',
      },
      {
        key: 'can_view_analytics',
        label: 'View analytics',
        description: 'Access Google Analytics and GBP performance data',
      },
      {
        key: 'can_view_social',
        label: 'View social metrics',
        description: 'Access Facebook, Instagram, LinkedIn data',
      },
      {
        key: 'can_manage_tasks',
        label: 'Manage tasks',
        description: 'Create, edit, and complete marketing tasks',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger data syncs',
      },
    ],
  },
  {
    app: 'admin_panel',
    label: 'Admin Panel',
    permissions: [
      {
        key: 'can_manage_users',
        label: 'Manage users',
        description: 'Create, update, and deactivate user accounts',
      },
      {
        key: 'can_view_audit_log',
        label: 'View audit log',
        description: 'Access the audit trail of user and permission changes',
      },
    ],
  },
  {
    app: 'ar_collections',
    label: 'AR Collections',
    permissions: [
      {
        key: 'can_view_ar_dashboard',
        label: 'View AR dashboard',
        description: 'Access accounts receivable dashboard and reports',
      },
      {
        key: 'can_manage_collections',
        label: 'Manage collections',
        description: 'Update collection status and add notes',
      },
      {
        key: 'can_export_reports',
        label: 'Export reports',
        description: 'Download AR reports and aging summaries',
      },
      {
        key: 'can_write_off_accounts',
        label: 'Write off accounts',
        description: 'Mark accounts as written off or uncollectable',
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
      {
        key: 'can_manage_users',
        label: 'Manage users',
        description: 'Add and manage debrief users and roles',
      },
      {
        key: 'can_manage_spot_checks',
        label: 'Manage spot checks',
        description: 'Create and review spot checks',
      },
    ],
  },
  {
    app: 'job_tracker',
    label: 'Job Tracker',
    permissions: [
      {
        key: 'can_view_trackers',
        label: 'View trackers',
        description: 'Access job tracker dashboard and view all trackers',
      },
      {
        key: 'can_manage_trackers',
        label: 'Manage trackers',
        description: 'Create, edit, and update job trackers and milestones',
      },
      {
        key: 'can_manage_templates',
        label: 'Manage templates',
        description: 'Create and edit milestone templates',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger ServiceTitan sync',
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
