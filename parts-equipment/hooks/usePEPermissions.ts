"use client";

import { useSession } from "next-auth/react";

export function usePEPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const user = session?.user;
  const role = user?.role || "employee";
  const permissions = (user as any)?.permissions?.parts_equipment || {};

  const isOwner = role === "owner";

  const canView = isOwner || !!permissions.can_view;
  const canManage = isOwner || !!permissions.can_manage;
  const canSyncData = isOwner || !!permissions.can_sync_data;

  return {
    isLoading,
    isOwner,
    role,
    user,
    userId: user?.id,
    canView,
    canManage,
    canSyncData,
  };
}
