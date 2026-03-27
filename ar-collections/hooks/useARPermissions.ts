"use client";

import { useSession } from "next-auth/react";

export function useARPermissions() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user;
  const role = user?.role || "employee";

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  // JSONB permissions from portal_users — single source of truth for AR access
  const perms = (user as any)?.permissions?.ar_collections as Record<string, boolean> | undefined;
  const hasPerm = (key: string) => isOwner || !!perms?.[key];

  // All permission checks use JSONB permissions only (no role-based fallbacks)
  const canViewInvoices = hasPerm("can_view_invoices");
  const canUpdateWorkflow = hasPerm("can_update_invoices");
  const canAddNotes = hasPerm("can_update_invoices");
  const canCreateTasks = hasPerm("can_update_invoices");
  const canEditAnyTask = hasPerm("can_update_invoices");
  const canAssignOwner = hasPerm("can_update_invoices");
  const canChangeControlBucket = hasPerm("can_update_invoices");
  const canMarkWrittenOff = hasPerm("can_update_invoices");
  const canManageTemplates = hasPerm("can_manage_settings");
  const canSendCommunications = hasPerm("can_log_communications");
  const canRunManualSync = hasPerm("can_manage_settings");
  const canRunBackfill = isOwner;
  const canManageSettings = hasPerm("can_manage_settings");
  const canAccessAdmin = hasPerm("can_manage_settings");

  // In-house financing permissions
  const canCreatePaymentPlan = hasPerm("can_update_invoices");
  const canEditPaymentPlan = hasPerm("can_update_invoices");
  const canRecordPayment = hasPerm("can_update_invoices");

  // Report permissions
  const canViewReports = hasPerm("can_view_reports");
  const canExportData = hasPerm("can_view_reports");

  const userDepartmentId = user?.departmentId;
  const userDepartment = user?.department;
  const userId = user?.id;

  return {
    // Status
    isLoading,
    isAuthenticated,

    // User info
    user,
    userId,
    role,
    userDepartmentId,
    userDepartment,

    // Role checks
    isOwner,
    isManager,
    isEmployee,

    // Invoice permissions
    canViewInvoices,
    canUpdateWorkflow,
    canAddNotes,
    canAssignOwner,
    canChangeControlBucket,
    canMarkWrittenOff,

    // Task permissions
    canCreateTasks,
    canEditAnyTask,

    // Communication permissions
    canManageTemplates,
    canSendCommunications,

    // Payment plan permissions
    canCreatePaymentPlan,
    canEditPaymentPlan,
    canRecordPayment,

    // Sync/admin permissions
    canRunManualSync,
    canRunBackfill,
    canManageSettings,
    canAccessAdmin,

    // Report permissions
    canViewReports,
    canExportData,
  };
}
