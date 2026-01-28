/**
 * @christmas-air/shared
 *
 * Shared code for Christmas Air Internal Tools
 */

// Permissions
export {
  type DailyDashPermissions,
  type InternalPortalPermissions,
  type DebriefQAPermissions,
  type MarketingHubPermissions,
  type AdminPanelPermissions,
  type ARCollectionsPermissions,
  type UserPermissions,
  type UserRole,
  type PermissionDefinition,
  type AppPermissionGroup,
  APP_PERMISSIONS,
  hasPermission,
  getEffectivePermissions,
  isPermissionExplicit,
  getExplicitPermission,
  setPermission,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from './permissions';

// Auth
export { createAuthOptions, ALLOWED_DOMAINS } from './auth';

// Types
export {
  type Department,
  type PortalUser,
  type AuditAction,
  type AuditLogEntry,
  type SessionValidationRequest,
  type SessionValidationResponse,
} from './types';
