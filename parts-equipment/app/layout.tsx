import type { Metadata } from 'next';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Parts & Equipment — Christmas Air',
  description: 'Parts ordering and equipment tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
