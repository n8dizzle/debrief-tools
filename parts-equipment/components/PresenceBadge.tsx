'use client';

const COLORS = ['#1565c0', '#2e7d32', '#6a0dad', '#e65100', '#00838f', '#c2185b', '#5d4037'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()) || '?';
}

export function colorFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Little avatar dots showing who else is currently on this line. */
export default function PresenceBadge({ peers }: { peers: { key: string; name: string }[] }) {
  if (!peers.length) return null;
  const names = peers.map(p => p.name).join(', ');
  return (
    <span
      style={{ display: 'inline-flex', gap: 2, marginLeft: 4, verticalAlign: 'middle' }}
      title={`${names} ${peers.length === 1 ? 'is' : 'are'} editing this line`}
    >
      {peers.map(p => (
        <span
          key={p.key}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: '50%', background: colorFor(p.name),
            color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1,
          }}
        >
          {initials(p.name)}
        </span>
      ))}
    </span>
  );
}
