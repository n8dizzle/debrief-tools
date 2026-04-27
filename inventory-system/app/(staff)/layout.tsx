import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
