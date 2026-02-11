"use client";

import { useSession } from "next-auth/react";

export function useMembershipPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // Membership Manager Permission Matrix
  // | Action                     | Employee | Manager | Owner |
  // |----------------------------|----------|---------|-------|
  // | View dashboard/memberships | yes      | yes     | yes   |
  // | View action queue          | yes      | yes     | yes   |
  // | Add staff notes            | yes      | yes     | yes   |
  // | View reports               | no       | yes     | yes   |
  // | Trigger sync               | no       | yes     | yes   |

  const canViewMemberships = true;
  const canManageNotes = true;
  const canViewReports = isOwner || isManager;
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
    canViewMemberships,
    canManageNotes,
    canViewReports,
    canSyncData,
  };
}
