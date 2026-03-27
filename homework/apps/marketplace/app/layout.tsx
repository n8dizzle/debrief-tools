import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Homework - Home Services Marketplace',
  description:
    'Find trusted home service professionals for every part of your home. Browse, book, and pay for services with confidence.',
  keywords: [
    'home services',
    'marketplace',
    'contractors',
    'home repair',
    'home improvement',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[var(--hw-bg)] text-[var(--hw-text)] antialiased">
        {children}
      </body>
    </html>
  );
}
