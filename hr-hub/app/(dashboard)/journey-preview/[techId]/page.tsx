import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase';
import { getTechJourney } from '@/lib/ladder-server';
import JourneyView from '@/components/JourneyView';

export const dynamic = 'force-dynamic';

// Supervisor preview of a technician's read-only self-view. Gated by the (dashboard)
// layout (Google SSO + hr_hub.can_access). Shows exactly what the tech sees on /me.
export default async function JourneyPreviewPage({ params }: { params: Promise<{ techId: string }> }) {
  const { techId } = await params;
  const stId = Number(techId);
  const supabase = getServerSupabase();

  const { data: tech } = await supabase
    .from('ap_technicians').select('name, business_unit_name, hourly_rate, is_active').eq('st_technician_id', stId).maybeSingle();

  const banner = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, borderRadius: 10, padding: '10px 14px', backgroundColor: 'rgba(58,143,87,.12)', border: '1px solid var(--christmas-green)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
        <span style={{ fontWeight: 700 }}>Preview</span> — this is exactly what {tech?.name || 'the technician'} sees on their phone.
      </div>
      <Link href="/ladder" style={{ fontSize: 13, color: 'var(--christmas-green)', whiteSpace: 'nowrap' }}>← Back to ladder</Link>
    </div>
  );

  if (!tech || !tech.is_active) {
    return <div style={{ maxWidth: 720 }}>{banner}<div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Technician not found.</div></div>;
  }

  const journey = await getTechJourney(supabase, stId, tech.business_unit_name ?? null, tech.hourly_rate != null ? Number(tech.hourly_rate) : null);

  return (
    <div style={{ maxWidth: 720 }}>
      {banner}
      {!journey ? (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          {tech.name} isn&apos;t on a ladder yet — they&apos;d see a &ldquo;not on a ladder yet&rdquo; message.
        </div>
      ) : (
        <JourneyView techName={tech.name} tree={journey.tree} statuses={journey.statuses} curId={journey.curId} />
      )}
    </div>
  );
}
