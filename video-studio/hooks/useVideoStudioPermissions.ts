"use client";

import { useSession } from "next-auth/react";

export function useVideoStudioPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";

  const perms = (user as any)?.permissions?.video_studio as Record<string, boolean> | undefined;
  const hasPerm = (key: string) => isOwner || !!perms?.[key];

  const canCreateVideos = hasPerm("can_create_videos");
  const canManageTemplates = hasPerm("can_manage_templates");
  const canViewAllVideos = hasPerm("can_view_all_videos");

  return {
    isLoading,
    isAuthenticated,
    user,
    userId: user?.id,
    role,
    isOwner,
    isManager,
    canCreateVideos,
    canManageTemplates,
    canViewAllVideos,
  };
}
