"use client";

import { useSession } from "next-auth/react";

// Mirrors internal-portal HRHubPermissions (portal_users.permissions.hr_hub).
export function useHRPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";
  const isOwner = role === "owner";

  const perms = (user as any)?.permissions?.hr_hub as Record<string, boolean> | undefined;
  const hasPerm = (key: string) => isOwner || !!perms?.[key];

  return {
    isLoading,
    isAuthenticated,
    user,
    userId: user?.id,
    role,
    isOwner,

    canAccess: hasPerm("can_access"),
    canViewOnboardings: hasPerm("can_view_onboardings"),
    canCreateOnboardings: hasPerm("can_create_onboardings"),
    canManageTemplates: hasPerm("can_manage_templates"),
    canCompleteAnyTask: hasPerm("can_complete_any_task"),
    canViewReports: hasPerm("can_view_reports"),
    // The ladder is a management view; gate edits behind template management for now.
    canEditLadder: hasPerm("can_manage_templates"),
  };
}
