"use client";

import { useSession } from "next-auth/react";

export function useDocDispatchPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";
  const userId = user?.id;

  const isOwner = role === "owner";
  const isManager = role === "manager";

  // All authenticated users can scan and view documents
  const canScanDocuments = isAuthenticated;
  const canViewDocuments = isAuthenticated;

  // Managers+ can manage settings and reassign
  const canManageSettings = isOwner || isManager;
  const canReassignActions = isOwner || isManager;

  return {
    isLoading,
    isAuthenticated,
    user,
    userId,
    role,
    isOwner,
    isManager,
    canScanDocuments,
    canViewDocuments,
    canManageSettings,
    canReassignActions,
  };
}
