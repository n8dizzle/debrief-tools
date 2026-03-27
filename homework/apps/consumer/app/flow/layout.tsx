import Image from "next/image"
import Link from "next/link"

export default function FlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary via-secondary to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-secondary/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="block">
            <Image
              src="/logo.svg"
              alt="homework"
              width={120}
              height={24}
              className="h-6 w-auto"
              priority
            />
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">
        {children}
      </main>
    </div>
  )
}
