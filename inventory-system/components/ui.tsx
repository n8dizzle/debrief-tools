// Small presentation primitives. Server-component-safe (no client hooks).

import Link from 'next/link';
import { titleCase } from '@/lib/format';

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="text-sm text-text-secondary hover:text-christmas-green-light">
          ← {back.label}
        </Link>
      )}
      <div className={`${back ? 'mt-2' : ''} flex items-baseline justify-between gap-4`}>
        <div>
          <h1 className="text-2xl font-semibold text-christmas-cream">{title}</h1>
          {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-bg-card border border-border-subtle rounded-lg p-5 ${className}`}>
      {title && <h2 className="text-sm font-medium text-text-primary mb-3">{title}</h2>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sublabel }: { label: string; value: React.ReactNode; sublabel?: string }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-christmas-cream tabular-nums">{value}</div>
      {sublabel && <div className="text-xs text-text-secondary mt-1">{sublabel}</div>}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary text-right">{value}</dd>
    </div>
  );
}

export function Badge({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}) {
  const variantClasses = {
    default: 'bg-bg-card-hover text-text-secondary',
    success: 'bg-christmas-green/15 text-christmas-green-light',
    warning: 'bg-yellow-900/30 text-yellow-300',
    danger: 'bg-red-900/30 text-red-300',
    info: 'bg-blue-900/30 text-blue-300',
  } as const;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  const s = status.toLowerCase();
  let variant: 'default' | 'success' | 'warning' | 'danger' | 'info' = 'default';
  if (['active', 'available', 'completed', 'received'].includes(s)) variant = 'success';
  else if (['draft', 'pending', 'pending_review', 'collecting', 'scheduled', 'sent', 'in_progress'].includes(s)) variant = 'info';
  else if (['locked', 'approved', 'partially_received', 'partially_completed', 'picked', 'checked_out'].includes(s)) variant = 'warning';
  else if (['cancelled', 'denied', 'inactive', 'retired', 'damaged', 'out_for_service', 'out_of_service'].includes(s)) variant = 'danger';
  return <Badge variant={variant}>{titleCase(s)}</Badge>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center text-text-muted text-sm">{message}</div>
  );
}

export function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className={`text-${align} px-4 py-2.5 font-medium`}>{children}</th>
  );
}

export function Td({
  children,
  align = 'left',
  mono,
  muted,
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const cls = [
    `text-${align}`,
    'px-4 py-2.5',
    mono ? 'font-mono text-xs' : '',
    muted ? 'text-text-secondary' : '',
    className,
  ].filter(Boolean).join(' ');
  return <td className={cls}>{children}</td>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-bg-secondary text-text-muted text-xs uppercase tracking-wide">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border-subtle">{children}</tbody>;
}
