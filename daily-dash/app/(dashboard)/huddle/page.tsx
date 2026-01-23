import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import HuddleDashboard from '@/features/huddle/components/HuddleDashboard';
import { getYesterdayDateString } from '@/lib/huddle-utils';

export const metadata = {
  title: 'Daily Huddle | Christmas Air',
  description: 'Daily leadership huddle dashboard',
};

export default async function DashHuddlePage() {
  const session = await getServerSession(authOptions);

  // Determine if user can edit notes (managers and owners)
  const canEditNotes = session?.user?.role !== 'employee';

  // Default to yesterday's date for morning huddles
  const defaultDate = getYesterdayDateString();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--christmas-cream)' }}
        >
          Daily Huddle
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Review yesterday&apos;s numbers and add notes for context
        </p>
      </div>

      <HuddleDashboard canEditNotes={canEditNotes} defaultDate={defaultDate} showHeader={false} />
    </div>
  );
}
