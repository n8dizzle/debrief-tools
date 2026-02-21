'use client';

import { useDashboardStore } from '@/store/dashboardStore';
import { ToastContainer } from './Toast';

export function ToastProvider() {
  const { toasts, removeToast } = useDashboardStore();
  return <ToastContainer toasts={toasts} onRemove={removeToast} />;
}
