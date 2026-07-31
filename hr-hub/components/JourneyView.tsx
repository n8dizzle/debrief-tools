import {
  flatTiers, tierItems, itemsForBucket, bucketsOnTier, getTier,
  type LadderTree, type SkillStatus,
} from '@/lib/ladder-types';

// Read-only "My Journey" render — shared by the tech-facing /me page and the
// supervisor preview. Pure/server-safe (no client hooks).
export default function JourneyView({ techName, tree, statuses, curId }: {
  techName: string;
  tree: LadderTree;
  statuses: Record<string, SkillStatus>;
  curId: string | null;
}) {
  const statusOf = (itemId: string): SkillStatus => statuses[itemId] ?? 'not_started';
  const flat = flatTiers(tree);
  const curTier = getTier(tree, curId);
  const curOrder = curTier?.order ?? -1;
  const allItems = flat.flatMap((t) => tierItems(t));
  const verified = allItems.filter((it) => statusOf(it.id) === 'verified').length;
  const climb = allItems.length ? Math.round((verified / allItems.length) * 100) : 0;
  const nextTier = curOrder >= 0 ? flat[curOrder + 1] : flat[0];
  const nextGaps = nextTier ? tierItems(nextTier).filter((it) => statusOf(it.id) !== 'verified') : [];

  return (
    <>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{techName}</div>
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
    </>
  );
}
