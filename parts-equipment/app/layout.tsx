import type { Metadata } from 'next';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';
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
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
