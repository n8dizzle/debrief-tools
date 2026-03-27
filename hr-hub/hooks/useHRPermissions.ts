"use client";

import { useSession } from "next-auth/react";

export function useHRPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const canViewOnboardings = true;
  const canCreateOnboardings = isOwner || isManager;
  const canManageTemplates = isOwner;
  const canCompleteAnyTask = isOwner;
  const canViewReports = isOwner || isManager;

  const userId = user?.id;

  return {
    isLoading,
    isAuthenticated,
    user,
    userId,
    role,
    isOwner,
    isManager,
    isEmployee,
    canViewOnboardings,
    canCreateOnboardings,
    canManageTemplates,
    canCompleteAnyTask,
    canViewReports,
  };
}
