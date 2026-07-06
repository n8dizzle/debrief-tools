'use client';
import { useRouter } from 'next/navigation';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import { daysSince, ageColor, fmtMoney } from '@/lib/pe-utils';
import type { PEOrder } from '@/types';

function fmtMD(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

interface QuadrantTableProps {
  orders: PEOrder[];
  columns: Array<{ key: string; label: string; style?: React.CSSProperties }>;
  renderCell: (o: PEOrder, key: string) => React.ReactNode;
  emptyText: string;
  onRowClick?: (o: PEOrder) => void;
  onCloseout?: (id: number) => void;
}

function QuadrantTable({ orders, columns, renderCell, emptyText, onRowClick, onCloseout }: QuadrantTableProps) {
  if (!orders.length) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
        {emptyText}
      </div>
    );
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f0ece3', position: 'sticky', top: 0, zIndex: 1 }}>
          {columns.map(col => (
            <th key={col.key} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', ...col.style }}>
              {col.label}
            </th>
          ))}
          {onCloseout && <th style={{ width: 30, borderBottom: '1px solid var(--border)' }} />}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', cursor: onRowClick ? 'pointer' : 'default' }}
            onClick={onRowClick ? () => onRowClick(o) : undefined}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
            {columns.map(col => (
              <td key={col.key} style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                {renderCell(o, col.key)}
              </td>
            ))}
            {onCloseout && (
              <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                <button title="Close out / Cancel"
                  onClick={e => { e.stopPropagation(); onCloseout(o.id); }}
                  style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1.3 }}>✕</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DashboardPage() {
  const { orders, isLoading, openCloseout } = useOrders() as OrdersContextValue;
  const router = useRouter();

  // Clicking a dashboard line takes you to the tab where it lives, focused on that row.
  const goToLine = (o: PEOrder) => {
    const tab = o.order_type === 'install' ? '/install' : '/service';
    router.push(`${tab}?focus=${o.id}`);
  };
  const open = orders.filter(o => o.status === 'open');

  // New Orders: sold in the last 7 days, still needs ordering. Falls off once
  // Part(s) Ordered is checked (order placed) or the location moves off Place Order.
  const newOrders = open.filter(o =>
    o.location === 'Place Order' && !o.parts_ordered && daysSince(o.date) <= 7);

  // Ready to Schedule: service jobs whose part is in — Location "Lewisville Shop"
  // or Parts at Shop checked — for the Service Dispatcher / CXR to schedule.
  const svcOrders = open
    .filter(o => o.order_type === 'service' && (o.location === 'Lewisville Shop' || o.parts_at_shop))
    .sort((a, b) => daysSince(b.date) - daysSince(a.date))
    .slice(0, 50);

  const instOrders = open
    .filter(o => o.order_type === 'install')
    .sort((a, b) => daysSince(b.date) - daysSince(a.date))
    .slice(0, 50);

  const agingOrders = open
    .filter(o => daysSince(o.date) > 30)
    .sort((a, b) => daysSince(b.date) - daysSince(a.date));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 110px)', color: 'var(--muted)', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  const quadStyle: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14, padding: 14, height: 'calc(100vh - 110px)', boxSizing: 'border-box' }}>

      {/* TOP LEFT: New Orders Queue */}
      <div style={quadStyle}>
        <div style={{ background: '#1a5276', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: .3 }}>New Orders</span>
          <span style={{ fontSize: 12, opacity: .8 }}>{newOrders.length} order{newOrders.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ padding: '7px 12px', background: '#eaf4fb', borderBottom: '1px solid var(--border)', fontSize: 11, color: '#1a5276', flexShrink: 0 }}>
          Sold in the last 7 days — still needs ordering (falls off once Part(s) Ordered is checked)
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <QuadrantTable
            onRowClick={goToLine}
            onCloseout={openCloseout}
            orders={newOrders}
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'job', label: 'Job #' },
              { key: 'type', label: 'Type' },
              { key: 'tech', label: 'Sold By' },
              { key: 'estcost', label: 'Est. Cost' },
              { key: 'age', label: 'Age', style: { textAlign: 'right' } },
            ]}
            renderCell={(o, key) => {
              const age = daysSince(o.date);
              switch (key) {
                case 'customer': return <span style={{ fontWeight: 500 }}>{o.customer}</span>;
                case 'job': return o.st_url
                  ? <a href={o.st_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>#{o.job} ↗</a>
                  : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>#{o.job}</span>;
                case 'type': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.subtype || o.order_type}</span>;
                case 'tech': return o.tech;
                case 'estcost': return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{fmtMoney(o.estimate_cost || o.job_cost) || '—'}</span>;
                case 'age': return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: ageColor(age), textAlign: 'right', display: 'block' }}>{age}d</span>;
                default: return null;
              }
            }}
            emptyText="No new orders in queue."
          />
        </div>
      </div>

      {/* TOP RIGHT: Ready to Schedule */}
      <div style={quadStyle}>
        <div style={{ background: '#2d4a3e', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: .3 }}>Ready to Schedule</span>
          <span style={{ fontSize: 12, opacity: .8 }}>{svcOrders.length} ready</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <QuadrantTable
            onRowClick={goToLine}
            onCloseout={openCloseout}
            orders={svcOrders}
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'job', label: 'Job #' },
              { key: 'type', label: 'Type' },
              { key: 'owner', label: 'Owner' },
              { key: 'location', label: 'Location' },
              { key: 'age', label: 'Age', style: { textAlign: 'right' } },
            ]}
            renderCell={(o, key) => {
              const age = daysSince(o.date);
              switch (key) {
                case 'customer': return <span style={{ fontWeight: 500 }}>{o.customer}</span>;
                case 'job': return o.st_url
                  ? <a href={o.st_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>#{o.job} ↗</a>
                  : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>#{o.job}</span>;
                case 'type': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.subtype}</span>;
                case 'owner': return <span style={{ fontSize: 11 }}>{o.owner}</span>;
                case 'location': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.location}</span>;
                case 'age': return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: ageColor(age), textAlign: 'right', display: 'block' }}>{age}d</span>;
                default: return null;
              }
            }}
            emptyText="No open service orders."
          />
        </div>
      </div>

      {/* BOTTOM LEFT: Install Quick Look */}
      <div style={quadStyle}>
        <div style={{ background: '#7a1c2e', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: .3 }}>Install</span>
          <span style={{ fontSize: 12, opacity: .8 }}>{instOrders.length} open</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <QuadrantTable
            onRowClick={goToLine}
            onCloseout={openCloseout}
            orders={instOrders}
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'job', label: 'Job #' },
              { key: 'part', label: 'Equipment' },
              { key: 'owner', label: 'Owner' },
              { key: 'location', label: 'Status' },
              { key: 'age', label: 'Age', style: { textAlign: 'right' } },
            ]}
            renderCell={(o, key) => {
              const age = daysSince(o.date);
              switch (key) {
                case 'customer': return <span style={{ fontWeight: 500 }}>{o.customer}</span>;
                case 'job': return o.st_url
                  ? <a href={o.st_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>#{o.job} ↗</a>
                  : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>#{o.job}</span>;
                case 'part': return <span style={{ fontSize: 11 }}>{o.part?.slice(0, 30)}{o.part && o.part.length > 30 ? '…' : ''}</span>;
                case 'owner': return <span style={{ fontSize: 11 }}>{o.owner}</span>;
                case 'location': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.location}</span>;
                case 'age': return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: ageColor(age), textAlign: 'right', display: 'block' }}>{age}d</span>;
                default: return null;
              }
            }}
            emptyText="No open install orders."
          />
        </div>
      </div>

      {/* BOTTOM RIGHT: Over 30 Days */}
      <div style={quadStyle}>
        <div style={{ background: '#7a2020', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: .3 }}>Over 30 Days</span>
          <span style={{ fontSize: 12, opacity: .8 }}>{agingOrders.length} order{agingOrders.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <QuadrantTable
            onRowClick={goToLine}
            onCloseout={openCloseout}
            orders={agingOrders}
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'job', label: 'Job #' },
              { key: 'type', label: 'Type' },
              { key: 'owner', label: 'Owner' },
              { key: 'location', label: 'Location' },
              { key: 'days', label: 'Days', style: { textAlign: 'right' } },
            ]}
            renderCell={(o, key) => {
              const age = daysSince(o.date);
              switch (key) {
                case 'customer': return <span style={{ fontWeight: 500 }}>{o.customer}</span>;
                case 'job': return o.st_url
                  ? <a href={o.st_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>#{o.job} ↗</a>
                  : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>#{o.job}</span>;
                case 'type': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.order_type === 'install' ? 'Install' : o.subtype}</span>;
                case 'owner': return <span style={{ fontSize: 11 }}>{o.owner}</span>;
                case 'location': return <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.location}</span>;
                case 'days': return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--red)', textAlign: 'right', display: 'block' }}>{age}d</span>;
                default: return null;
              }
            }}
            emptyText="No orders over 30 days. Great work!"
          />
        </div>
      </div>

    </div>
  );
}
