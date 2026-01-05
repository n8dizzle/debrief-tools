"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // Permission checks
  const canManageUsers = isOwner || isManager;
  const canManageAllUsers = isOwner;
  const canManageTools = isOwner;
  const canViewStats = isOwner || isManager;
  const canAccessAdmin = isOwner || isManager;

  const userDepartmentId = user?.departmentId;
  const userDepartment = user?.department;

  return {
    // Status
    isLoading,
    isAuthenticated,

    // User info
    user,
    role,
    userDepartmentId,
    userDepartment,

    // Role checks
    isOwner,
    isManager,
    isEmployee,

    // Permission checks
    canManageUsers,
    canManageAllUsers,
    canManageTools,
    canViewStats,
    canAccessAdmin,
  };
}
