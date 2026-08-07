import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rigor — Christmas Air',
  description: 'Work moving through steps, with someone holding it at every step.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><Shell>{children}</Shell></AuthProvider>
      </body>
    </html>
  );
}
