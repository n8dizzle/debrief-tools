"use client";

import { useSession } from "next-auth/react";

export function useServiceDashboardPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";

  // Service Dashboard permissions - owners always have all perms
  // Others need explicit grants via portal_users.permissions.service_dashboard
  const permissions = (user as any)?.permissions?.service_dashboard;

  const canViewDashboard = isOwner || permissions?.can_view_dashboard === true;
  const canManageSettings = isOwner || permissions?.can_manage_settings === true;
  const canManageAttendance = isOwner || isManager || permissions?.can_manage_attendance === true;
  const canSyncData = isOwner || permissions?.can_sync_data === true;

  return {
    isLoading,
    isAuthenticated,
    user,
    role,
    isOwner,
    isManager,
    canViewDashboard,
    canManageSettings,
    canManageAttendance,
    canSyncData,
  };
}
