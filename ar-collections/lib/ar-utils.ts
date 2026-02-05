/**
 * AR Collections utility functions
 */

import { ARAgingBucket, ARInvoiceStatus } from './supabase';

/**
 * Calculate days outstanding (DSO) from invoice date
 */
export function calculateDaysOutstanding(invoiceDate: string | Date): number {
  const invoice = new Date(invoiceDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - invoice.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine aging bucket based on days outstanding
 */
export function getAgingBucket(daysOutstanding: number): ARAgingBucket {
  if (daysOutstanding <= 30) return 'current';
  if (daysOutstanding <= 60) return '30';
  if (daysOutstanding <= 90) return '60';
  return '90+';
}

/**
 * Determine invoice status based on balance and total
 */
export function getInvoiceStatus(balance: number, total: number): ARInvoiceStatus {
  if (balance <= 0) return 'paid';
  if (balance < total) return 'partial';
  return 'open';
}

/**
 * Calculate due date for commercial (30 days) vs residential (immediate)
 */
export function calculateDueDate(
  invoiceDate: string | Date,
  customerType: 'residential' | 'commercial'
): Date {
  const date = new Date(invoiceDate);
  if (customerType === 'commercial') {
    date.setDate(date.getDate() + 30);
  }
  return date;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for display (MM/DD/YYYY)
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Format date with time (e.g., "01/28/2026 3:45 PM")
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

/**
 * Format date as MM/DD for notes (e.g., "1/20")
 */
export function formatNoteDate(date: string | Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Format a collection note in the standard format: "{date}-{initials}-{content}"
 */
export function formatCollectionNote(
  date: string | Date,
  initials: string,
  content: string
): string {
  return `${formatNoteDate(date)}-${initials.toLowerCase()}-${content}`;
}

/**
 * Parse initials from a user name (e.g., "John Smith" -> "js")
 */
export function getInitials(name: string): string {
  if (!name) return 'xx';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toLowerCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toLowerCase();
}

/**
 * Calculate average DSO from a list of invoices
 */
export function calculateAverageDSO(invoices: { days_outstanding: number }[]): number {
  if (invoices.length === 0) return 0;
  const total = invoices.reduce((sum, inv) => sum + inv.days_outstanding, 0);
  return Math.round(total / invoices.length);
}

/**
 * Group invoices by aging bucket
 */
export function groupByAgingBucket(
  invoices: { aging_bucket: ARAgingBucket; balance: number }[]
): Record<ARAgingBucket, number> {
  const buckets: Record<ARAgingBucket, number> = {
    current: 0,
    '30': 0,
    '60': 0,
    '90+': 0,
  };

  for (const invoice of invoices) {
    buckets[invoice.aging_bucket] += invoice.balance;
  }

  return buckets;
}

/**
 * Get today's date string in Central Time (America/Chicago)
 */
export function getTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/**
 * Get a date range for a month
 */
export function getMonthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Check if a date is overdue (past due date)
 */
export function isOverdue(dueDate: string | Date): boolean {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Calculate estimated end date for a payment plan
 */
export function calculatePaymentPlanEndDate(
  startDate: string | Date,
  totalBalance: number,
  monthlyPayment: number
): Date {
  const months = Math.ceil(totalBalance / monthlyPayment);
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + months);
  return end;
}

/**
 * Get the display label for an aging bucket
 */
export function getAgingBucketLabel(bucket: ARAgingBucket): string {
  switch (bucket) {
    case 'current':
      return 'Current';
    case '30':
      return '31-60 Days';
    case '60':
      return '61-90 Days';
    case '90+':
      return '90+ Days';
  }
}

/**
 * Get color class for aging bucket
 */
export function getAgingBucketColor(bucket: ARAgingBucket): string {
  switch (bucket) {
    case 'current':
      return 'text-green-500';
    case '30':
      return 'text-yellow-500';
    case '60':
      return 'text-orange-500';
    case '90+':
      return 'text-red-500';
  }
}

/**
 * Replace template placeholders with actual values
 */
export function replaceTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Clean phone number for API calls (E.164 format)
 */
export function cleanPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return phone;
}
