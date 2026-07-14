'use client';
import { initials, colorFor } from './PresenceBadge';
import type { ActiveUser } from '@/hooks/useOrders';

const MAX_SHOWN = 6;

/** Google-Sheets-style roster of everyone currently on the app (deduped per person). */
export default function PresenceBar({ users }: { users: ActiveUser[] }) {
  if (!users.length) return null;

  // Self first, then others alphabetically — stable, predictable order.
  const sorted = [...users].sort((a, b) => {
    if (a.self !== b.self) return a.self ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const shown = sorted.slice(0, MAX_SHOWN);
  const overflow = sorted.length - shown.length;

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center' }}
      title={`Active now: ${sorted.map(u => (u.self ? `${u.name} (you)` : u.name)).join(', ')}`}
    >
      {shown.map((u, i) => (
        <span
          key={u.name}
          title={u.self ? `${u.name} (you)` : u.name}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%',
            background: colorFor(u.name), color: '#fff',
            fontSize: 11, fontWeight: 700, lineHeight: 1,
            border: '2px solid var(--bg, #fff)',
            marginLeft: i === 0 ? 0 : -8,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
          }}
        >
          {initials(u.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={sorted.slice(MAX_SHOWN).map(u => u.name).join(', ')}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--muted, #64748b)', color: '#fff',
            fontSize: 11, fontWeight: 700, lineHeight: 1,
            border: '2px solid var(--bg, #fff)', marginLeft: -8,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
