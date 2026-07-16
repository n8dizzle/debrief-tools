import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { can, type AccessUser } from '@/lib/access';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Access is controlled by feature, managed from the portal: owners always in;
  // everyone else needs install_tracker.can_access granted on their portal account.
  if (!can(session.user as AccessUser, 'can_access')) {
    return (
      <div className="noaccess">
        <div className="noaccess-card">
          <div className="noaccess-mark">🔒</div>
          <h1>No access yet</h1>
          <p>You&apos;re signed in, but your account doesn&apos;t have access to Standard.</p>
          <p className="noaccess-sub">Ask an owner to grant you access in the Internal Portal (User settings → Standard → Can access).</p>
          <a className="noaccess-link" href="https://portal.christmasair.com">← Back to the portal</a>
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
