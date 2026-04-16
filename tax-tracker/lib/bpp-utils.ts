export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateAssetAge(yearAcquired: number, taxYear?: number): number {
  const year = taxYear || new Date().getFullYear();
  return year - yearAcquired;
}

export function getConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  };
  return labels[condition] || condition;
}

export function getConditionColor(condition: string): string {
  const colors: Record<string, string> = {
    new: '#22c55e',
    good: '#3b82f6',
    fair: '#eab308',
    poor: '#ef4444',
  };
  return colors[condition] || '#6b7280';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    filed: 'Filed',
    accepted: 'Accepted',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: '#eab308',
    filed: '#3b82f6',
    accepted: '#22c55e',
  };
  return colors[status] || '#6b7280';
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
