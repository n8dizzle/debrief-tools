import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Root() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  // Technicians land on the mobile scanner; everyone else on the dashboard.
  redirect(session.user.role === 'technician' ? '/scan' : '/dashboard');
}
