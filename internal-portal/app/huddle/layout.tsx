import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';

export default async function HuddleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Navigation Header */}
      <nav
        className="sticky top-0 z-10"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2"
                style={{ color: 'var(--christmas-cream)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'var(--christmas-green)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                <span className="font-bold text-lg">Christmas Air</span>
              </Link>
              <span
                className="text-sm px-2 py-1 rounded"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                }}
              >
                Daily Huddle
              </span>
            </div>

            {/* Nav Links */}
            <div className="flex items-center gap-4">
              <Link
                href="/huddle"
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                Dashboard
              </Link>
              <Link
                href="/huddle/history"
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                History
              </Link>
              <Link
                href="/"
                className="text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Back to Portal
              </Link>
            </div>

            {/* User */}
            <div className="flex items-center gap-3">
              <span
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {session.user.name || session.user.email}
              </span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                }}
              >
                {(session.user.name || session.user.email || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
