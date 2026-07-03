import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceTitanClient } from '@/lib/servicetitan';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/servicetitan/my-jobs
// Returns today's jobs assigned to the logged-in technician
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const st = new ServiceTitanClient();
    const supabase = getServerSupabase();
    const userEmail = session.user.email.toLowerCase();

    // 1. Look up the user's ST technician ID from team_members table
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('servicetitan_id, name')
      .eq('email', userEmail)
      .single();

    let technicianId: number | null = teamMember?.servicetitan_id || null;
    let technicianName: string = teamMember?.name || session.user.name || '';

    // Fallback: search ST technicians directly by email
    if (!technicianId) {
      const technicians = await st.getTechnicians(true);
      const match = technicians.find(
        t => t.email?.toLowerCase() === userEmail
      );
      if (match) {
        technicianId = match.id;
        technicianName = match.name;
      }
    }

    if (!technicianId) {
      return NextResponse.json({
        jobs: [],
        technicianName,
        error: 'No ServiceTitan technician found for your email. Contact admin to link your account.',
      });
    }

    // 2. Get today's scheduled jobs
    const today = formatLocalDate(new Date());
    const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
    const allJobs = await st.getScheduledJobs(today, tomorrow);

    if (allJobs.length === 0) {
      return NextResponse.json({ jobs: [], technicianName });
    }

    // 3. Get appointments for all jobs in parallel (batch)
    const jobAppointments = await Promise.all(
      allJobs.map(async (job) => {
        const appointments = await st.getJobAppointments(job.id);
        return { job, appointments };
      })
    );

    // 4. Collect all appointment IDs
    const allAppointmentIds = jobAppointments.flatMap(
      ja => ja.appointments.map(a => a.id)
    );

    if (allAppointmentIds.length === 0) {
      return NextResponse.json({ jobs: [], technicianName });
    }

    // 5. Get all appointment assignments in one call (or batched)
    // ST may limit the number of IDs per request, batch in chunks of 50
    const assignments: Array<{ appointmentId: number; technicianId: number; technicianName?: string }> = [];
    for (let i = 0; i < allAppointmentIds.length; i += 50) {
      const chunk = allAppointmentIds.slice(i, i + 50);
      const chunkAssignments = await st.getAppointmentAssignments(chunk);
      assignments.push(...chunkAssignments);
    }

    // 6. Find which appointments are assigned to this technician
    const myAppointmentIds = new Set(
      assignments
        .filter(a => a.technicianId === technicianId)
        .map(a => a.appointmentId)
    );

    // 7. Filter jobs that have at least one appointment assigned to this tech
    const myJobData = jobAppointments.filter(
      ja => ja.appointments.some(a => myAppointmentIds.has(a.id))
    );

    // 8. Fetch customer + location details for my jobs in parallel
    const myJobs = await Promise.all(
      myJobData.map(async ({ job, appointments }) => {
        const myAppt = appointments.find(a => myAppointmentIds.has(a.id));

        let customerName = '';
        let address = '';
        let phone = '';
        let email = '';
        let locationId = 0;

        try {
          const [customer, location] = await Promise.all([
            st.getCustomer(job.customerId),
            st.getLocation(job.locationId),
          ]);

          customerName = customer.name || '';
          phone = customer.contacts?.find(c => c.type === 'Phone' || c.type === 'MobilePhone')?.value || '';
          email = customer.contacts?.find(c => c.type === 'Email')?.value || '';
          const addr = location.address || customer.address;
          address = addr
            ? [addr.street, addr.unit, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
            : '';
          locationId = location.id;
        } catch {
          // If we can't fetch customer/location, still show the job
        }

        return {
          jobId: job.id,
          jobNumber: job.jobNumber,
          jobStatus: job.jobStatus,
          businessUnitName: job.businessUnitName,
          summary: job.summary,
          customerId: job.customerId,
          customerName,
          phone,
          email,
          address,
          locationId,
          appointmentStart: myAppt?.start,
          appointmentEnd: myAppt?.end,
        };
      })
    );

    // Sort by appointment time
    myJobs.sort((a, b) => {
      if (!a.appointmentStart) return 1;
      if (!b.appointmentStart) return -1;
      return a.appointmentStart.localeCompare(b.appointmentStart);
    });

    return NextResponse.json({ jobs: myJobs, technicianName, technicianId });
  } catch (err) {
    console.error('[My Jobs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
