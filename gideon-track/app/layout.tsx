import type { Metadata } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GideonTrack - Student Progress Tracker",
  description: "Track tutoring progress for Gideon Math and Reading",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${jakarta.variable}`}>
      <body style={{ fontFamily: 'var(--font-body), -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
