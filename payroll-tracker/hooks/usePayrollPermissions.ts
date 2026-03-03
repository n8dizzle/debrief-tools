"use client";

import { useSession } from "next-auth/react";

export function usePayrollPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // Payroll Tracker Permission Matrix
  // | Action                          | Employee | Manager | Owner |
  // |---------------------------------|----------|---------|-------|
  // | View dashboard/employees/times  | yes      | yes     | yes   |
  // | View pay amounts ($)            | no       | yes     | yes   |
  // | Trigger sync                    | no       | yes     | yes   |
  // | View settings                   | no       | yes     | yes   |

  const canViewDashboard = true;
  const canViewPayAmounts = isOwner || isManager;
  const canSyncData = isOwner || isManager;
  const canViewSettings = isOwner || isManager;

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
    canViewPayAmounts,
    canSyncData,
    canViewSettings,
  };
}
