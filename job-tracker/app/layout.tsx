import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Tracker | Christmas Air',
  description: 'Track your HVAC and Plumbing job progress',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
