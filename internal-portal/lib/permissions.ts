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
 * - Job Tracker
 * - AP Payments
 * - Membership Manager
 * - Celebrations
 *
 * JSONB stored in portal_users.permissions column
 */

// ============================================
// APP-SPECIFIC PERMISSION INTERFACES
// ============================================

export interface DailyDashPermissions {
  can_access?: boolean;
  can_edit_targets?: boolean;
  can_reply_reviews?: boolean;
  can_edit_huddle_notes?: boolean;
  can_sync_data?: boolean;
}

export interface InternalPortalPermissions {
  can_manage_tools?: boolean;
}

export interface DebriefQAPermissions {
  can_access?: boolean;
  can_view_all_jobs?: boolean;
  can_manage_users?: boolean;
  can_manage_spot_checks?: boolean;
}

export interface MarketingHubPermissions {
  can_access?: boolean;
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
  can_access?: boolean;
  can_view_invoices?: boolean;
  can_update_invoices?: boolean;
  can_log_communications?: boolean;
  can_view_reports?: boolean;
  can_manage_settings?: boolean;
}

export interface JobTrackerPermissions {
  can_access?: boolean;
  can_view_trackers?: boolean;
  can_manage_trackers?: boolean;
  can_manage_templates?: boolean;
  can_sync_data?: boolean;
}

export interface APPaymentsPermissions {
  can_access?: boolean;
  can_view_jobs?: boolean;
  can_manage_assignments?: boolean;
  can_manage_payments?: boolean;
  can_manage_contractors?: boolean;
  can_sync_data?: boolean;
}

export interface MembershipManagerPermissions {
  can_access?: boolean;
  can_view_memberships?: boolean;
  can_manage_notes?: boolean;
  can_view_reports?: boolean;
  can_sync_data?: boolean;
}

export interface CelebrationsPermissions {
  can_access?: boolean;
  can_view_boards?: boolean;
  can_create_boards?: boolean;
  can_manage_boards?: boolean;
  can_manage_slack?: boolean;
}

export interface DocDispatchPermissions {
  can_access?: boolean;
  can_view_documents?: boolean;
  can_manage_documents?: boolean;
  can_email_documents?: boolean;
}

export interface PayrollTrackerPermissions {
  can_access?: boolean;
  can_view_dashboard?: boolean;
  can_view_pay_amounts?: boolean;
  can_sync_data?: boolean;
}

export interface ServiceDashboardPermissions {
  can_access?: boolean;
  can_view_dashboard?: boolean;
  can_manage_settings?: boolean;
  can_manage_attendance?: boolean;
  can_sync_data?: boolean;
}

export interface HRHubPermissions {
  can_access?: boolean;
  can_view_onboardings?: boolean;
  can_create_onboardings?: boolean;
  can_manage_templates?: boolean;
  can_complete_any_task?: boolean;
  can_view_reports?: boolean;
}

export interface SalesCommandCenterPermissions {
  can_access?: boolean;
  can_view_leads?: boolean;
  can_manage_queue?: boolean;
  can_manage_settings?: boolean;
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
  ap_payments?: APPaymentsPermissions;
  membership_manager?: MembershipManagerPermissions;
  celebrations?: CelebrationsPermissions;
  doc_dispatch?: DocDispatchPermissions;
  payroll_tracker?: PayrollTrackerPermissions;
  service_dashboard?: ServiceDashboardPermissions;
  hr_hub?: HRHubPermissions;
  sales_command_center?: SalesCommandCenterPermissions;
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
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Daily Dash app',
      },
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
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Marketing Hub app',
      },
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
        key: 'can_access',
        label: 'Can access',
        description: 'Access the AR Collections app',
      },
      {
        key: 'can_view_invoices',
        label: 'View invoices',
        description: 'Access AR invoices and aging reports',
      },
      {
        key: 'can_update_invoices',
        label: 'Update invoices',
        description: 'Update invoice status, add notes, and manage collections',
      },
      {
        key: 'can_log_communications',
        label: 'Log communications',
        description: 'Record customer communications and follow-ups',
      },
      {
        key: 'can_view_reports',
        label: 'View reports',
        description: 'Access AR reports and analytics',
      },
      {
        key: 'can_manage_settings',
        label: 'Manage settings',
        description: 'Configure AR collections settings',
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
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Debrief QA app',
      },
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
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Job Tracker app',
      },
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
  {
    app: 'ap_payments',
    label: 'AP Payments',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the AP Payments app',
      },
      {
        key: 'can_view_jobs',
        label: 'View jobs',
        description: 'View install jobs and dashboard',
      },
      {
        key: 'can_manage_assignments',
        label: 'Manage assignments',
        description: 'Assign jobs to contractors or in-house',
      },
      {
        key: 'can_manage_payments',
        label: 'Manage payments',
        description: 'Update payment status (request, approve, mark paid)',
      },
      {
        key: 'can_manage_contractors',
        label: 'Manage contractors',
        description: 'Add/edit contractors and rate cards',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger ServiceTitan sync',
      },
    ],
  },
  {
    app: 'membership_manager',
    label: 'Membership Manager',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Membership Manager app',
      },
      {
        key: 'can_view_memberships',
        label: 'View memberships',
        description: 'View membership dashboard and member details',
      },
      {
        key: 'can_manage_notes',
        label: 'Manage notes',
        description: 'Add and edit staff notes on memberships',
      },
      {
        key: 'can_view_reports',
        label: 'View reports',
        description: 'Access membership reports and analytics',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger ServiceTitan membership sync',
      },
    ],
  },
  {
    app: 'celebrations',
    label: 'Celebrations',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Celebrations app',
      },
      {
        key: 'can_view_boards',
        label: 'View boards',
        description: 'View celebration boards and posts',
      },
      {
        key: 'can_create_boards',
        label: 'Create boards',
        description: 'Create new celebration boards',
      },
      {
        key: 'can_manage_boards',
        label: 'Manage boards',
        description: 'Edit, archive, and delete any board',
      },
      {
        key: 'can_manage_slack',
        label: 'Manage Slack',
        description: 'Configure Slack channel integrations',
      },
    ],
  },
  {
    app: 'doc_dispatch',
    label: 'Doc Dispatch',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Doc Dispatch app',
      },
      {
        key: 'can_view_documents',
        label: 'View documents',
        description: 'View scanned documents and AI analysis',
      },
      {
        key: 'can_manage_documents',
        label: 'Manage documents',
        description: 'Upload, analyze, and manage documents and action items',
      },
      {
        key: 'can_email_documents',
        label: 'Email documents',
        description: 'Send documents and action items via email',
      },
    ],
  },
  {
    app: 'payroll_tracker',
    label: 'Payroll Tracker',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Payroll Tracker app',
      },
      {
        key: 'can_view_dashboard',
        label: 'View dashboard',
        description: 'View payroll dashboard, employees, and timesheets',
      },
      {
        key: 'can_view_pay_amounts',
        label: 'View pay amounts',
        description: 'See dollar amounts for pay, performance pay, and rates',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger ServiceTitan payroll sync',
      },
    ],
  },
  {
    app: 'service_dashboard',
    label: 'Service Dashboard',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Service Dashboard app',
      },
      {
        key: 'can_view_dashboard',
        label: 'View dashboard',
        description: 'View service technician leaderboard and metrics',
      },
      {
        key: 'can_manage_settings',
        label: 'Manage settings',
        description: 'Configure scoring weights and sync settings',
      },
      {
        key: 'can_manage_attendance',
        label: 'Manage attendance',
        description: 'Add and remove attendance point records',
      },
      {
        key: 'can_sync_data',
        label: 'Sync data',
        description: 'Manually trigger ServiceTitan data sync',
      },
    ],
  },
  {
    app: 'hr_hub',
    label: 'HR Hub',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the HR Hub app',
      },
      {
        key: 'can_view_onboardings',
        label: 'View onboardings',
        description: 'View onboarding dashboard and employee onboardings',
      },
      {
        key: 'can_create_onboardings',
        label: 'Create onboardings',
        description: 'Create new employee onboardings',
      },
      {
        key: 'can_manage_templates',
        label: 'Manage templates',
        description: 'Create and edit onboarding workflow templates',
      },
      {
        key: 'can_complete_any_task',
        label: 'Complete any task',
        description: 'Complete any onboarding task regardless of assignment',
      },
      {
        key: 'can_view_reports',
        label: 'View reports',
        description: 'Access onboarding reports and analytics',
      },
    ],
  },
  {
    app: 'sales_command_center',
    label: 'Sales Command Center',
    permissions: [
      {
        key: 'can_access',
        label: 'Can access',
        description: 'Access the Sales Command Center app',
      },
      {
        key: 'can_view_leads',
        label: 'View leads',
        description: 'View sales leads and pipeline',
      },
      {
        key: 'can_manage_queue',
        label: 'Manage queue',
        description: 'Manage advisor queue and lead assignments',
      },
      {
        key: 'can_manage_settings',
        label: 'Manage settings',
        description: 'Configure sales settings and advisor profiles',
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
// APP ACCESS UTILITIES
// ============================================

/**
 * Check if a user can access a specific app.
 * Uses can_access permission. Owners always have access.
 */
export function hasAppAccess(
  role: UserRole,
  permissions: UserPermissions | null | undefined,
  app: keyof UserPermissions
): boolean {
  if (role === 'owner') return true;
  const appPerms = permissions?.[app];
  if (appPerms && 'can_access' in appPerms) {
    return (appPerms as Record<string, boolean>)['can_access'] === true;
  }
  return false;
}

/**
 * Get list of app keys the user can access.
 * Used by the portal homepage to determine which tool links to show.
 */
export function getAccessibleApps(
  role: UserRole,
  permissions: UserPermissions | null | undefined
): string[] {
  if (role === 'owner') {
    return APP_PERMISSIONS.map(g => g.app);
  }

  return APP_PERMISSIONS
    .filter(g => {
      // Skip apps without can_access (admin_panel, internal_portal)
      const hasCanAccess = g.permissions.some(p => p.key === 'can_access');
      if (!hasCanAccess) return false;
      const appPerms = permissions?.[g.app];
      if (appPerms && 'can_access' in appPerms) {
        return (appPerms as Record<string, boolean>)['can_access'] === true;
      }
      return false;
    })
    .map(g => g.app);
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
