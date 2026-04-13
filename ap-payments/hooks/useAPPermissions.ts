"use client";

import { useSession } from "next-auth/react";

export function useAPPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";
  const permissions = (user as any)?.permissions?.ap_payments || {};

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // All access is driven by portal permission toggles.
  // Owners always have full access. Everyone else needs explicit permissions.
  const canViewJobs = isOwner || !!permissions.can_view_jobs;
  const canManageAssignments = isOwner || !!permissions.can_manage_assignments;
  const canManagePayments = isOwner || !!permissions.can_manage_payments;
  const canApprovePayments = isOwner || !!permissions.can_approve_payments;
  const canIssuePayments = isOwner || !!permissions.can_issue_payments;
  const canManageContractors = isOwner || !!permissions.can_manage_contractors;
  const canSyncData = isOwner || !!permissions.can_sync_data;

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
    canIssuePayments,
    canManageContractors,
    canSyncData,
  };
}
