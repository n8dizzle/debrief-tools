import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import HuddleDashboard from '@/components/huddle/HuddleDashboard';

export const metadata = {
  title: 'Daily Huddle | Christmas Air',
  description: 'Daily leadership huddle dashboard',
};

export default async function HuddlePage() {
  const session = await getServerSession(authOptions);

  // Determine if user can edit notes (managers and owners)
  const canEditNotes = session?.user?.role !== 'employee';

  return <HuddleDashboard canEditNotes={canEditNotes} />;
}
