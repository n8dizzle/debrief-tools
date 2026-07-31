import { getCurrentTech } from '@/lib/tech-auth';
import { getServerSupabase } from '@/lib/supabase';
import { getTechJourney } from '@/lib/ladder-server';
import JourneyView from '@/components/JourneyView';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '20px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'var(--christmas-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" stroke="var(--on-accent)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v18M16 3v18M8 6h8M8 10h8M8 14h8M8 18h8" /></svg>
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Christmas Air — My Career Ladder</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Msg({ title, body }: { title: string; body: string }) {
  return <Shell><div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}><div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div><div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{body}</div></div></Shell>;
}

export default async function MyJourneyPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const tech = await getCurrentTech();
  if (!tech) {
    return <Msg title={sp?.e === 'expired' ? 'That link has expired' : 'Open your link to continue'} body="Tap the most recent Christmas Air text with your career-ladder link. If you need a new one, ask your manager to text it again." />;
  }

  const supabase = getServerSupabase();
  const { data: row } = await supabase.from('ap_technicians').select('business_unit_name, hourly_rate').eq('st_technician_id', tech.st_technician_id).maybeSingle();
  const journey = await getTechJourney(supabase, tech.st_technician_id, row?.business_unit_name ?? null, row?.hourly_rate != null ? Number(row.hourly_rate) : null);
  if (!journey) return <Msg title={`Hi ${tech.name.split(' ')[0]}`} body="You're not on a career ladder yet. Check back after your manager sets one up." />;

  return <Shell><JourneyView techName={tech.name} tree={journey.tree} statuses={journey.statuses} curId={journey.curId} /></Shell>;
}
