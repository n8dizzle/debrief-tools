"use client";

import { useSession } from "next-auth/react";

export function useCelebrationsPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";

  const canViewBoards = true;
  const canCreateBoards = isOwner || isManager;
  const canManageBoards = isOwner || isManager;
  const canManageSlack = isOwner || isManager;

  return {
    isLoading,
    isAuthenticated,
    user,
    userId: user?.id,
    role,
    isOwner,
    isManager,
    canViewBoards,
    canCreateBoards,
    canManageBoards,
    canManageSlack,
  };
}
