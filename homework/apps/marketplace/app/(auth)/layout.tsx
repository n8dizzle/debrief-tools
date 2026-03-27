import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--hw-bg-secondary)]">
      {/* Minimal Header */}
      <header className="border-b border-[var(--hw-border)] bg-white dark:bg-[var(--hw-bg)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--hw-text)]">
              Homework
            </span>
          </Link>
        </div>
      </header>

      {/* Centered Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[var(--hw-border)] bg-white py-4 text-center text-xs text-[var(--hw-text-tertiary)] dark:bg-[var(--hw-bg)]">
        &copy; {new Date().getFullYear()} Homework. All rights reserved.
      </footer>
    </div>
  );
}
