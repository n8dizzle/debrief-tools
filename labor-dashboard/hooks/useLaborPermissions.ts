"use client";

import { useSession } from "next-auth/react";

export function useLaborPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // Labor Dashboard Permission Matrix
  // | Action                 | Employee | Manager | Owner |
  // |------------------------|----------|---------|-------|
  // | View dashboard         | yes      | yes     | yes   |
  // | View employees         | yes      | yes     | yes   |
  // | Trigger sync           | no       | yes     | yes   |

  const canViewDashboard = true;
  const canViewEmployees = true;
  const canSyncData = isOwner || isManager;

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
    canViewDashboard,
    canViewEmployees,
    canSyncData,
  };
}
