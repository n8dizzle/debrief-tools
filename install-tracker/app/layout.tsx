import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Christmas Air — Install Tracker',
  description: 'Visual map of the install process, end to end.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
