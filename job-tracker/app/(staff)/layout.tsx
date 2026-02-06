'use client';

import { SessionProvider } from 'next-auth/react';
import DashboardShell from '@/components/DashboardShell';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}
