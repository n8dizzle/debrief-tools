import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { MarketingHeader } from '@/components/MarketingHeader';
import { Footer } from '@/components/Footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Homework - Home Services, Simplified',
    template: '%s | Homework',
  },
  description:
    'Compare prices, book instantly, and get quality home services from vetted local contractors.',
  keywords: [
    'home services',
    'home repair',
    'contractors',
    'home improvement',
    'DFW',
    'Dallas',
    'Fort Worth',
    'plumbing',
    'HVAC',
    'electrical',
    'landscaping',
    'roofing',
  ],
  openGraph: {
    title: 'Homework - Home Services, Simplified',
    description:
      'Compare prices, book instantly, and get quality home services from vetted local contractors.',
    url: 'https://homework.com',
    siteName: 'Homework',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homework - Home Services, Simplified',
    description:
      'Compare prices, book instantly, and get quality home services from vetted local contractors.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <MarketingHeader />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
