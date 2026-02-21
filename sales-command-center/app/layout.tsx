import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Christmas Air & Plumbing - Sales Dashboard',
  description: 'Lead tracking and sales dashboard for comfort advisors',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
