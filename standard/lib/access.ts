// Feature access for the Standard, managed from the portal. Owners get
// everything; everyone else needs the specific permission granted on their portal
// account (portal_users.permissions.install_tracker). Client- and server-safe.

export type InstallPerm = 'can_access' | 'can_triage_deals' | 'can_edit_workflow' | 'can_sync_data';

export type AccessUser = {
  role?: string;
  permissions?: { install_tracker?: Partial<Record<InstallPerm, boolean>> } | null;
} | null | undefined;

export function can(user: AccessUser, perm: InstallPerm): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.permissions?.install_tracker?.[perm] === true;
}
