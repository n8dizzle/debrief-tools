'use client';
import { useState, useEffect, useRef } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { TECHS, OWNERS, LOCATIONS, INSTALL_LOCATIONS, SVC_SUBTYPES, INST_SUBTYPES, WARRANTY_TYPES, CANCEL_REASONS } from '@/lib/constants';
import { formatLocalDate, looksLikeCurrency, STAGES, BLOCKED_REASONS } from '@/lib/pe-utils';

interface Props {
  orderId: number;
  onClose: () => void;
}

export default function EditDetailModal({ orderId, onClose }: Props) {
  const { orders, saveOrderDebounced, logAudit, showToast, installTeams, suppliers } = useOrders();
  const order = orders.find(o => o.id === orderId);

  const [changedBy, setChangedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [estimatesText, setEstimatesText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (order?.estimates) {
      try {
        const parsed = typeof order.estimates === 'string' ? JSON.parse(order.estimates) : order.estimates;
        if (Array.isArray(parsed)) {
          setEstimatesText(parsed.map((e: { description: string; amount: string }) => `${e.description}: ${e.amount}`).join('\n'));
        }
      } catch {
        setEstimatesText('');
      }
    }
  }, [order?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!order) {
    return (
      <>
        <div className="panel-overlay" onClick={onClose} />
        <div className="panel detail-panel">
          <div className="panel-header">
            <div style={{ fontWeight: 700 }}>Order not found</div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
      </>
    );
  }

  function save(changes: Record<string, unknown>) {
    saveOrderDebounced(orderId, changes);
  }

  function saveField(field: string, value: unknown) {
    save({ [field]: value });
  }

  async function saveWithNote() {
    setSaving(true);
    try {
      if (changedBy.trim()) {
        await logAudit({
          type: order!.order_type || 'service',
          job_id: order!.job,
          customer: order!.customer,
          action: 'updated',
          detail: `Manual save by ${changedBy.trim()}`,
          changed_by: changedBy.trim(),
        });
      }
      showToast('Changes saved');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function openST() {
    if (order?.st_url) window.open(order.st_url, '_blank');
    else if (order?.job) window.open(`https://go.servicetitan.com/#/Job/Index/${order.job}`, '_blank');
  }

  const isInstall = order.order_type === 'install';
  const isWarranty = ['Yes', 'P', 'P/L', 'L'].includes(order.warranty ?? '');

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, display: 'block', textTransform: 'uppercase', letterSpacing: .4 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' };
  const fieldGroup = (label: string, child: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={labelStyle}>{label}</label>
      {child}
    </div>
  );

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div ref={panelRef} className="panel detail-panel">

        {/* Header */}
        <div className="panel-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{isInstall ? 'Install' : 'Service'} Order Detail</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
              {order.job ? `#${order.job}` : 'New Order'}{order.customer ? ` — ${order.customer}` : ''}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Status badge */}
        <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5,
            background: order.status === 'open' ? '#e8f4fd' : order.status === 'completed' ? '#eafaf1' : '#fdecec',
            color: order.status === 'open' ? '#1565c0' : order.status === 'completed' ? '#1a9e6a' : '#c0392b',
          }}>{order.status}</span>
          {order.owner && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Owner: <strong>{order.owner}</strong></span>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Section: Job Info */}
          <div className="detail-section">
            <div className="detail-section-title">Job Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {fieldGroup('Job #', <input style={inputStyle} value={order.job || ''} onChange={e => saveField('job', e.target.value)} placeholder="Job number" />)}
              {fieldGroup('Customer', <input style={inputStyle} value={order.customer || ''} onChange={e => saveField('customer', e.target.value)} />)}
              {fieldGroup('Date', <input style={inputStyle} type="date" value={order.date || ''} onChange={e => saveField('date', e.target.value)} />)}
              {fieldGroup('Sold By (Tech)', (
                <select style={inputStyle} value={order.tech || ''} onChange={e => saveField('tech', e.target.value)}>
                  <option value="">—</option>
                  {TECHS.map(t => <option key={t}>{t}</option>)}
                </select>
              ))}
              {fieldGroup('Type', (
                <select style={inputStyle} value={order.subtype || ''} onChange={e => saveField('subtype', e.target.value)}>
                  <option value="">—</option>
                  {(isInstall ? INST_SUBTYPES : SVC_SUBTYPES).map(s => <option key={s}>{s}</option>)}
                </select>
              ))}
              {fieldGroup('Owner', (
                <select style={inputStyle} value={order.owner || ''} onChange={e => saveField('owner', e.target.value)}>
                  <option value="">—</option>
                  {OWNERS.map(o => <option key={o}>{o}</option>)}
                </select>
              ))}
              {fieldGroup('Board (Tab)', (
                <select style={inputStyle} value={order.order_type || 'service'} onChange={e => saveField('order_type', e.target.value)}>
                  <option value="service">Service</option>
                  <option value="install">Install</option>
                </select>
              ))}
              {fieldGroup(isInstall ? 'Job Cost' : 'Est. Subtotal', (
                <input style={inputStyle} value={isInstall ? (order.job_cost || '') : (order.estimate_cost || '')}
                  onChange={e => saveField(isInstall ? 'job_cost' : 'estimate_cost', e.target.value)} placeholder="$0.00" />
              ))}
              {isInstall && fieldGroup('Install Team', (
                <select style={inputStyle} value={order.install_team || ''} onChange={e => saveField('install_team', e.target.value)}>
                  <option value="">—</option>
                  {order.install_team && !installTeams.includes(order.install_team) && !looksLikeCurrency(order.install_team) && <option value={order.install_team}>{order.install_team}</option>}
                  {installTeams.map(t => <option key={t}>{t}</option>)}
                </select>
              ))}
              {fieldGroup('ServiceTitan URL', (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={order.st_url || ''} onChange={e => saveField('st_url', e.target.value)} placeholder="https://..." />
                  {(order.st_url || order.job) && (
                    <button onClick={openST} style={{ padding: '7px 10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Open ST</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section: Order Info */}
          <div className="detail-section">
            <div className="detail-section-title">Order Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fieldGroup(isInstall ? 'Equipment to Order' : 'Part / Description', (
                <input style={inputStyle} value={order.part || ''} onChange={e => saveField('part', e.target.value)} placeholder="Part or equipment description" />
              ))}
              {fieldGroup('Supplier', (
                <select style={inputStyle} value={order.supplier || ''} onChange={e => saveField('supplier', e.target.value)}>
                  <option value="">—</option>
                  {order.supplier && !suppliers.includes(order.supplier) && <option value={order.supplier}>{order.supplier}</option>}
                  {suppliers.map(s => <option key={s}>{s}</option>)}
                </select>
              ))}
              {fieldGroup('Order #', <input style={inputStyle} value={order.order_num || ''} onChange={e => saveField('order_num', e.target.value)} />)}
              {fieldGroup(isInstall ? 'Equip. Cost' : 'Actual Cost', (
                <input style={inputStyle} value={isInstall ? (order.equip_cost || '') : (order.cost || '')}
                  onChange={e => saveField(isInstall ? 'equip_cost' : 'cost', e.target.value)} placeholder="$0.00" />
              ))}
              {fieldGroup('Stage', (
                <select style={inputStyle} value={order.stage || 'needs_order'} onChange={e => saveField('stage', e.target.value)}>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ))}
              {fieldGroup('Blocked', (
                <select style={inputStyle} value={order.blocked || ''} onChange={e => saveField('blocked', e.target.value)}>
                  <option value="">—</option>
                  {BLOCKED_REASONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              ))}
              {fieldGroup('Location', (
                <select style={inputStyle} value={order.location || ''} onChange={e => saveField('location', e.target.value)}>
                  <option value="">—</option>
                  {(isInstall ? INSTALL_LOCATIONS : LOCATIONS).map(l => <option key={l}>{l}</option>)}
                </select>
              ))}
              {fieldGroup('ETA', <input style={inputStyle} type="date" value={order.eta || ''} onChange={e => saveField('eta', e.target.value)} />)}
              {fieldGroup('Tracking', <input style={inputStyle} value={order.tracking || ''} onChange={e => saveField('tracking', e.target.value)} placeholder="Tracking number or URL" />)}
              {fieldGroup('Warranty', (
                <select style={inputStyle} value={order.warranty || ''} onChange={e => saveField('warranty', e.target.value)}>
                  <option value="">—</option>
                  {WARRANTY_TYPES.map(w => <option key={w}>{w}</option>)}
                </select>
              ))}
              {isWarranty && fieldGroup('Warranty Type', (
                <select style={inputStyle} value={order.warranty_type || ''} onChange={e => saveField('warranty_type', e.target.value)}>
                  <option value="">—</option>
                  {['P', 'L', 'P/L'].map(w => <option key={w}>{w}</option>)}
                </select>
              ))}
              {isInstall && fieldGroup('Scheduled Date', (
                <input style={inputStyle} type="date" value={order.sched_date || order.scheduled_date || ''} onChange={e => saveField('sched_date', e.target.value)} />
              ))}
              {isInstall && fieldGroup('QC Date', (
                <input style={inputStyle} type="date" value={order.qc_date || ''} onChange={e => saveField('qc_date', e.target.value)} />
              ))}
            </div>
          </div>

          {/* Section: Checkboxes */}
          <div className="detail-section">
            <div className="detail-section-title">Status Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { key: 'needs_order', label: 'Needs Order' },
                { key: 'parts_ordered', label: 'Parts Ordered' },
                { key: 'part_bo', label: 'Part B/O' },
                { key: 'bo_informed', label: 'Cust. Inf. B/O' },
                { key: 'parts_at_shop', label: 'Parts at Shop' },
                ...(isInstall ? [
                  { key: 'bo_ordered', label: 'B/O Ordered' },
                  { key: 'call_booked', label: 'Call Booked' },
                  { key: 'qc_scheduled', label: 'QC Scheduled' },
                ] : [
                  { key: 'two_techs', label: '2 Techs?' },
                  { key: 'is_equipment', label: 'Is Equipment' },
                  { key: 'bo_notified', label: 'B/O Notified' },
                ]),
                { key: 'multiple_estimates', label: 'Multiple Estimates' },
              ].map(cb => (
                <label key={cb.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox"
                    checked={!!(order as unknown as Record<string, unknown>)[cb.key]}
                    onChange={e => saveField(cb.key, e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  {cb.label}
                </label>
              ))}
            </div>
          </div>

          {/* Section: Notes */}
          <div className="detail-section">
            <div className="detail-section-title">Notes</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fieldGroup('Warehouse Notes', (
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={order.note_wh || ''} onChange={e => saveField('note_wh', e.target.value)} placeholder="Warehouse team notes..." />
              ))}
              {fieldGroup('CXR Notes', (
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={order.note_cxr || ''} onChange={e => saveField('note_cxr', e.target.value)} placeholder="CXR team notes..." />
              ))}
            </div>
          </div>

          {/* Estimates (if multiple) */}
          {order.multiple_estimates && (
            <div className="detail-section">
              <div className="detail-section-title">Estimate Items</div>
              <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--muted)' }}>One per line: Description: $Amount</div>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}
                value={estimatesText}
                onChange={e => {
                  setEstimatesText(e.target.value);
                  const lines = e.target.value.split('\n').filter(Boolean);
                  const parsed = lines.map(line => {
                    const colonIdx = line.lastIndexOf(':');
                    if (colonIdx === -1) return { description: line.trim(), amount: '' };
                    return { description: line.slice(0, colonIdx).trim(), amount: line.slice(colonIdx + 1).trim() };
                  });
                  saveField('estimates', parsed);
                }}
                placeholder="Part A: $150.00&#10;Labor: $250.00"
              />
            </div>
          )}

          {/* Linked Jobs */}
          <div className="detail-section">
            <div className="detail-section-title">Linked Jobs</div>
            <input
              style={inputStyle}
              value={Array.isArray(order.linked_jobs) ? order.linked_jobs.join(', ') : (order.linked_jobs || '')}
              onChange={e => {
                const val = e.target.value;
                const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                saveField('linked_jobs', arr.length > 0 ? arr : []);
              }}
              placeholder="Comma-separated job numbers e.g. 12345, 67890"
            />
          </div>

          {/* Cancel info if cancelled */}
          {order.status === 'cancelled' && (
            <div className="detail-section">
              <div className="detail-section-title">Cancellation Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {fieldGroup('Cancel Reason', (
                  <select style={inputStyle} value={order.cancel_reason || ''} onChange={e => saveField('cancel_reason', e.target.value)}>
                    <option value="">—</option>
                    {CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                ))}
                {fieldGroup('Cancel Source', (
                  <input style={inputStyle} value={order.cancel_source || ''} onChange={e => saveField('cancel_source', e.target.value)} placeholder="Who requested?" />
                ))}
              </div>
            </div>
          )}

          {/* Completion info if completed */}
          {order.status === 'completed' && (
            <div className="detail-section">
              <div className="detail-section-title">Scheduled Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {fieldGroup('Scheduled By', (
                  <input style={inputStyle} value={order.completed_by || ''} onChange={e => saveField('completed_by', e.target.value)} />
                ))}
                {fieldGroup('Scheduled At', (
                  <input style={inputStyle} type="date" value={order.completed_at || ''} onChange={e => saveField('completed_at', e.target.value)} />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="panel-footer">
          <input
            style={{ ...inputStyle, maxWidth: 200, fontSize: 12 }}
            value={changedBy}
            onChange={e => setChangedBy(e.target.value)}
            placeholder="Changed by (your name)"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {(order.st_url || order.job) && (
              <button className="btn" style={{ fontSize: 12 }} onClick={openST}>Open ST ↗</button>
            )}
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn btn-primary" disabled={saving} onClick={saveWithNote}>
              {saving ? 'Saving...' : 'Save & Close'}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
