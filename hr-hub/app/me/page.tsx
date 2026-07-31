import { getCurrentTech } from '@/lib/tech-auth';
import { getServerSupabase } from '@/lib/supabase';
import { getLadderTree, resolveTechLadderId } from '@/lib/ladder-server';
import { flatTiers, tierItems, itemsForBucket, bucketsOnTier, getTier, tierFromHourlyRate, type LadderTree, type SkillStatus } from '@/lib/ladder-types';

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
  const { data: row } = await supabase
    .from('ap_technicians').select('business_unit_name, hourly_rate').eq('st_technician_id', tech.st_technician_id).maybeSingle();
  const ladderId = await resolveTechLadderId(supabase, tech.st_technician_id, row?.business_unit_name ?? null);
  if (!ladderId) return <Msg title={`Hi ${tech.name.split(' ')[0]}`} body="You're not on a career ladder yet. Check back after your manager sets one up." />;

  const tree = await getLadderTree(supabase, ladderId);
  if (!tree) return <Msg title="Ladder unavailable" body="We couldn't load your ladder right now. Try again later." />;

  const { data: placement } = await supabase.from('hr_tech_ladder').select('current_tier_id').eq('st_technician_id', tech.st_technician_id).maybeSingle();
  const { data: statusRows } = await supabase.from('hr_tech_skill_status').select('item_id, status').eq('st_technician_id', tech.st_technician_id).not('item_id', 'is', null);
  const statusOf = (itemId: string): SkillStatus => (statusRows || []).find((s) => s.item_id === itemId)?.status ?? 'not_started';

  const flat = flatTiers(tree);
  const curId = placement?.current_tier_id ?? tierFromHourlyRate(tree, row?.hourly_rate != null ? Number(row.hourly_rate) : null);
  const curTier = getTier(tree, curId);
  const curOrder = curTier?.order ?? -1;
  const allItems = flat.flatMap((t) => tierItems(t));
  const verified = allItems.filter((it) => statusOf(it.id) === 'verified').length;
  const climb = allItems.length ? Math.round((verified / allItems.length) * 100) : 0;
  const nextTier = curOrder >= 0 ? flat[curOrder + 1] : flat[0];
  const nextGaps = nextTier ? tierItems(nextTier).filter((it) => statusOf(it.id) !== 'verified') : [];

  return (
    <Shell>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{tech.name}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>{curTier ? `${curTier.levelName}${curTier.pay_label ? ' · ' + curTier.pay_label : ''}` : 'Not yet placed on the ladder'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}><span>Your progress</span><span>{verified}/{allItems.length} skills signed off · {climb}%</span></div>
        <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}><div style={{ height: '100%', width: `${climb}%`, backgroundColor: 'var(--christmas-green)' }} /></div>
        {nextTier && (
          <div style={{ marginTop: 16, borderRadius: 8, padding: 12, backgroundColor: 'rgba(217,147,10,0.12)', border: '1px solid rgba(217,147,10,0.4)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>To reach {nextTier.pay_label || nextTier.levelName}{nextGaps.length ? ` — ${nextGaps.length} to go` : ''}</div>
            {nextGaps.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You&apos;ve met every requirement for the next step. Talk to your manager!</div> : (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--text-secondary)' }}>{nextGaps.slice(0, 10).map((it) => <li key={it.id} style={{ marginBottom: 3 }}>{it.text}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {[...tree.levels].sort((a, b) => a.sort_order - b.sort_order).map((lvl) => (
        <div key={lvl.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{lvl.name}{lvl.timeframe ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>  ({lvl.timeframe})</span> : null}</div>
          {[...lvl.tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier) => {
            const items = tierItems(tier);
            const v = items.filter((it) => statusOf(it.id) === 'verified').length;
            const isCur = curId === tier.id;
            return (
              <div key={tier.id} style={{ marginTop: 8, borderRadius: 10, border: isCur ? '2px solid var(--christmas-green)' : '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{tier.pay_label || lvl.name}{isCur ? '  ← you are here' : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}/{items.length}</span>
                </div>
                <div style={{ padding: 12 }}>
                  {bucketsOnTier(tree, tier).map((b) => (
                    <div key={b.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 3 }}>{b.name}</div>
                      {itemsForBucket(tier, b.id).map((it) => {
                        const s = statusOf(it.id);
                        const mark = s === 'verified' ? '✓' : s === 'in_progress' ? '◐' : '○';
                        const color = s === 'verified' ? 'var(--christmas-green)' : s === 'in_progress' ? '#d9930a' : 'var(--text-muted)';
                        return <div key={it.id} style={{ display: 'flex', gap: 8, fontSize: 13, color: s === 'not_started' ? 'var(--text-muted)' : 'var(--text-primary)', padding: '2px 0' }}><span style={{ color }}>{mark}</span><span>{it.text}</span></div>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>Questions about your ladder? Talk to your manager.</p>
    </Shell>
  );
}
