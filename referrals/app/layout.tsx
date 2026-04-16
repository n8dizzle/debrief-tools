import type { Metadata } from "next";
import { Lobster, Open_Sans } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lobster",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neighbors Helping Neighbors — Christmas Air",
  description:
    "Refer your neighbors to Christmas Air Conditioning & Plumbing. Everyone wins — you, them, and a charity you choose.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${lobster.variable} ${openSans.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
