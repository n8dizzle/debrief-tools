/**
 * In-House Financing utility functions
 */

import { ARPayment, UpcomingPayment, PaymentSchedule } from './supabase';

/**
 * Calculate the next payment due date based on due day and last payment
 */
export function getNextDueDate(dueDay: number, lastPaymentDate: string | null): Date {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Start with due date in current month
  let nextDue = new Date(currentYear, currentMonth, dueDay);

  // If we're past the due day this month, move to next month
  if (today.getDate() > dueDay) {
    nextDue = new Date(currentYear, currentMonth + 1, dueDay);
  }

  // If there's a last payment date, make sure next due is after it
  if (lastPaymentDate) {
    const lastPayment = new Date(lastPaymentDate);
    const lastPaymentMonth = lastPayment.getMonth();
    const lastPaymentYear = lastPayment.getFullYear();

    // If last payment was this month, next due is next month
    if (lastPaymentYear === currentYear && lastPaymentMonth === currentMonth) {
      nextDue = new Date(currentYear, currentMonth + 1, dueDay);
    }
    // If last payment was in a future month (edge case), adjust
    if (lastPayment > nextDue) {
      nextDue = new Date(lastPaymentYear, lastPaymentMonth + 1, dueDay);
    }
  }

  return nextDue;
}

/**
 * Calculate projected payoff date based on balance and monthly payment
 */
export function getProjectedPayoffDate(
  balance: number,
  monthlyAmount: number,
  dueDay: number,
  lastPaymentDate: string | null
): Date | null {
  if (!monthlyAmount || monthlyAmount <= 0 || balance <= 0) return null;

  const paymentsRemaining = Math.ceil(balance / monthlyAmount);
  const nextDue = getNextDueDate(dueDay, lastPaymentDate);

  // Add remaining payments (minus 1 since nextDue is payment 1)
  const payoffDate = new Date(nextDue);
  payoffDate.setMonth(payoffDate.getMonth() + paymentsRemaining - 1);

  return payoffDate;
}

/**
 * Calculate number of payments remaining
 */
export function getPaymentsRemaining(balance: number, monthlyAmount: number): number {
  if (!monthlyAmount || monthlyAmount <= 0) return 0;
  if (balance <= 0) return 0;
  return Math.ceil(balance / monthlyAmount);
}

/**
 * Generate upcoming payment schedule
 */
export function generatePaymentSchedule(
  balance: number,
  monthlyAmount: number,
  dueDay: number,
  lastPaymentDate: string | null,
  maxPayments: number = 6
): PaymentSchedule {
  if (!monthlyAmount || monthlyAmount <= 0 || balance <= 0) {
    return {
      upcoming: [],
      projected_payoff_date: null,
      payments_remaining: 0,
      total_remaining: balance,
    };
  }

  const paymentsRemaining = getPaymentsRemaining(balance, monthlyAmount);
  const numToShow = Math.min(paymentsRemaining, maxPayments);
  const upcoming: UpcomingPayment[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDue = getNextDueDate(dueDay, lastPaymentDate);
  let remainingBalance = balance;

  for (let i = 0; i < numToShow; i++) {
    const amount = Math.min(monthlyAmount, remainingBalance);
    const isOverdue = currentDue < today;

    upcoming.push({
      due_date: currentDue.toISOString().split('T')[0],
      amount,
      is_overdue: isOverdue,
      is_next: i === 0,
    });

    remainingBalance -= amount;
    // Move to next month
    currentDue = new Date(currentDue);
    currentDue.setMonth(currentDue.getMonth() + 1);
  }

  const projectedPayoff = getProjectedPayoffDate(balance, monthlyAmount, dueDay, lastPaymentDate);

  return {
    upcoming,
    projected_payoff_date: projectedPayoff?.toISOString().split('T')[0] || null,
    payments_remaining: paymentsRemaining,
    total_remaining: balance,
  };
}

/**
 * Calculate payment history with running balance
 */
export function calculatePaymentHistoryWithBalance(
  payments: ARPayment[],
  invoiceTotal: number
): (ARPayment & { running_balance: number })[] {
  // Sort payments by date ascending (oldest first)
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  );

  let runningBalance = invoiceTotal;
  const result = sortedPayments.map(payment => {
    runningBalance -= payment.amount;
    return {
      ...payment,
      running_balance: Math.max(0, runningBalance),
    };
  });

  // Return in reverse order (newest first) for display
  return result.reverse();
}

/**
 * Check if a payment is late (paid after due date)
 */
export function isPaymentLate(
  paymentDate: string,
  dueDay: number,
  graceDays: number = 5
): boolean {
  const payment = new Date(paymentDate);
  const paymentMonth = payment.getMonth();
  const paymentYear = payment.getFullYear();

  // Due date for that month
  const dueDate = new Date(paymentYear, paymentMonth, dueDay + graceDays);

  return payment > dueDate;
}

/**
 * Format payment progress as percentage
 */
export function getPaymentProgress(invoiceTotal: number, balance: number): number {
  if (invoiceTotal <= 0) return 100;
  const paid = invoiceTotal - balance;
  return Math.round((paid / invoiceTotal) * 100);
}

/**
 * Format due day as ordinal (1st, 2nd, 3rd, etc.)
 */
export function formatDueDay(day: number): string {
  if (day === 1 || day === 21) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

/**
 * Get days until next payment
 */
export function getDaysUntilNextPayment(nextDueDate: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format days until payment for display
 */
export function formatDaysUntil(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `in ${days} days`;
}
