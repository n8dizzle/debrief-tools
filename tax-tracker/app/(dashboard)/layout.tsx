import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;
  if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_access) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary, #111)', color: 'var(--text-primary, #fff)' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h1>
          <p style={{ color: 'var(--text-secondary, #aaa)', marginBottom: '1.5rem' }}>
            You don&apos;t have access to this app. Contact your administrator.
          </p>
          <a href="https://portal.christmasair.com" style={{ color: 'var(--christmas-green, #22c55e)', textDecoration: 'underline' }}>
            Go to Portal
          </a>
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
