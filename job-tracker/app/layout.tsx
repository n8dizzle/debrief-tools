import type { Metadata } from 'next';
import './globals.css';
import { resolveTheme } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Job Tracker | Christmas Air',
  description: 'Track your HVAC and Plumbing job progress',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await resolveTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
