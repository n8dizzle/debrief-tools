"use client";

import { useSession } from "next-auth/react";

export function useBPPPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";

  const perms = (user as any)?.permissions?.bpp_tracker as Record<string, boolean> | undefined;
  const hasPerm = (key: string) => isOwner || !!perms?.[key];

  const canViewAssets = hasPerm("can_view_assets");
  const canManageAssets = hasPerm("can_manage_assets");
  const canFileRenditions = hasPerm("can_file_renditions");
  const canManageCategories = hasPerm("can_manage_categories");

  return {
    isLoading,
    isAuthenticated,
    user,
    userId: user?.id,
    role,
    isOwner,
    canViewAssets,
    canManageAssets,
    canFileRenditions,
    canManageCategories,
  };
}
