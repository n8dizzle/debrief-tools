import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { ChevronLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-10 bg-bg-secondary border-b border-border-subtle">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/scan" className="flex items-center gap-2 text-sm text-text-secondary hover:text-christmas-cream">
            <ChevronLeft size={18} />
            <span className="font-semibold text-christmas-cream">Scanner</span>
          </Link>
          <div className="text-xs text-text-muted truncate max-w-[40vw]">{session.user.email}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 bg-bg-secondary border-t border-border-subtle">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-2">
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-christmas-cream px-2 py-2"
          >
            Office portal
          </Link>
          <LogoutButton />
        </div>
      </nav>
    </div>
  );
}
