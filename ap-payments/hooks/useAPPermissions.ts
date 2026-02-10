"use client";

import { useSession } from "next-auth/react";

export function useAPPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // AP Payments Permission Matrix
  // | Action                 | Employee | Manager | Owner |
  // |------------------------|----------|---------|-------|
  // | View jobs/dashboard    | yes      | yes     | yes   |
  // | Assign jobs            | no       | yes     | yes   |
  // | Manage payments        | no       | yes     | yes   |
  // | Manage contractors     | no       | yes     | yes   |
  // | Trigger sync           | no       | yes     | yes   |
  // | Approve payments       | no       | no      | yes   |

  const canViewJobs = true;
  const canManageAssignments = isOwner || isManager;
  const canManagePayments = isOwner || isManager;
  const canApprovePayments = isOwner;
  const canManageContractors = isOwner || isManager;
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
    canViewJobs,
    canManageAssignments,
    canManagePayments,
    canApprovePayments,
    canManageContractors,
    canSyncData,
  };
}
