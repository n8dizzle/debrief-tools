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

  // AR Collections Permission Matrix
  // | Action | Viewer | Collections Specialist | Manager | Admin |
  // |--------|--------|----------------------|---------|-------|
  // | View invoices | ✓ | ✓ | ✓ | ✓ |
  // | Update workflow checkboxes | ✗ | ✓ | ✓ | ✓ |
  // | Add notes | ✗ | ✓ | ✓ | ✓ |
  // | Create/edit tasks | ✗ | Own only | Any | Any |
  // | Assign owner | ✗ | ✗ | ✓ | ✓ |
  // | Change control bucket | ✗ | ✗ | ✓ | ✓ |
  // | Mark written off | ✗ | ✗ | ✗ | ✓ |
  // | Manage templates | ✗ | ✗ | ✓ | ✓ |
  // | Send email/SMS | ✗ | ✓ | ✓ | ✓ |
  // | Run manual sync | ✗ | ✗ | ✓ | ✓ |
  // | Run backfill | ✗ | ✗ | ✗ | ✓ |
  // | Manage users/settings | ✗ | ✗ | ✗ | ✓ |

  // Basic permission checks
  const canViewInvoices = true; // All authenticated users
  const canUpdateWorkflow = isOwner || isManager || isEmployee; // Collections specialists are employees
  const canAddNotes = isOwner || isManager || isEmployee;
  const canCreateTasks = isOwner || isManager || isEmployee;
  const canEditAnyTask = isOwner || isManager;
  const canAssignOwner = isOwner || isManager;
  const canChangeControlBucket = isOwner || isManager;
  const canMarkWrittenOff = isOwner;
  const canManageTemplates = isOwner || isManager;
  const canSendCommunications = isOwner || isManager || isEmployee;
  const canRunManualSync = isOwner || isManager;
  const canRunBackfill = isOwner;
  const canManageSettings = isOwner;
  const canAccessAdmin = isOwner || isManager;

  // In-house financing permissions
  const canCreatePaymentPlan = isOwner || isManager;
  const canEditPaymentPlan = isOwner || isManager;
  const canRecordPayment = isOwner || isManager || isEmployee;

  // Report permissions
  const canViewReports = isOwner || isManager;
  const canExportData = isOwner || isManager;

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
