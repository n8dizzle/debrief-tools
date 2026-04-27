import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import Sidebar from '@/components/Sidebar';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
