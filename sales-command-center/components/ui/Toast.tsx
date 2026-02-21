'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: AlertCircle,
};

const styles = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  info: 'border-sage/30 bg-sage/10',
};

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-sage',
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = icons[toast.type];

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in',
        styles[toast.type]
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', iconStyles[toast.type])} />
      <p className="text-sm text-foreground flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
