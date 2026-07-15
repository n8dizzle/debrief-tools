import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { resolveTheme } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Christmas Air — Standard',
  description: 'Workflow status and bottlenecks across the operation — where the work stands, and what’s slipping.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await resolveTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
