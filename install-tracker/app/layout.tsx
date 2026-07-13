import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { resolveTheme } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Christmas Air — Install Tracker',
  description: 'Visual map of the install process, end to end.',
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
