import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import { resolveTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Parts & Equipment — Christmas Air',
  description: 'Parts ordering and equipment tracking',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await resolveTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
