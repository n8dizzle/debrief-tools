'use client';
import { useState, useRef, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { CANCEL_REASONS } from '@/lib/constants';
import { formatLocalDate } from '@/lib/pe-utils';

interface Props {
  orderId: number;
  onClose: () => void;
}

type Mode = 'choose' | 'closeout' | 'cancel';

export default function CloseoutModal({ orderId, onClose }: Props) {
  const { orders, saveOrderDebounced, showToast } = useOrders();
  const order = orders.find(o => o.id === orderId);

  const [mode, setMode] = useState<Mode>('choose');
  const [completedBy, setCompletedBy] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSource, setCancelSource] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!order) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <div style={{ fontWeight: 700 }}>Order not found</div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  async function handleCloseout() {
    if (!completedBy.trim()) { showToast('Please enter who is closing this out', 'error'); return; }
    setSaving(true);
    const today = formatLocalDate(new Date());
    saveOrderDebounced(orderId, {
      status: 'completed',
      completed_by: completedBy.trim(),
      completed_at: today,
      note_cxr: note ? (order!.note_cxr ? order!.note_cxr + ' | ' + note : note) : order!.note_cxr,
    });
    showToast('Order closed out');
    onClose();
    setSaving(false);
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { showToast('Please select a cancel reason', 'error'); return; }
    setSaving(true);
    saveOrderDebounced(orderId, {
      status: 'cancelled',
      cancel_reason: cancelReason,
      cancel_source: cancelSource,
      note_cxr: note ? (order!.note_cxr ? order!.note_cxr + ' | CANCELLED: ' + note : 'CANCELLED: ' + note) : order!.note_cxr,
    });
    showToast('Order cancelled');
    onClose();
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)',
  };

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: 480 }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {mode === 'choose' ? 'Close / Cancel Order' : mode === 'closeout' ? 'Close Out Order' : 'Cancel Order'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {order.customer ? order.customer : order.job ? `Job #${order.job}` : 'Order'}
              {order.job && order.customer ? ` — Job #${order.job}` : ''}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Mode Chooser */}
          {mode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>What would you like to do with this order?</p>
              <button className="wizard-type-btn" onClick={() => setMode('closeout')}>
                <div className="wizard-type-icon" style={{ background: '#1a9e6a' }}>✔</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Close Out</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Order is complete — part received and job done</div>
                </div>
              </button>
              <button className="wizard-type-btn" onClick={() => setMode('cancel')}>
                <div className="wizard-type-icon" style={{ background: '#c0392b' }}>✕</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Cancel PO</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Cancel this order and record why</div>
                </div>
              </button>
            </div>
          )}

          {/* Close Out Form */}
          {mode === 'closeout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '10px 14px', background: '#eafaf1', border: '1px solid #a9dfbf', borderRadius: 8, fontSize: 13, color: '#1e8449' }}>
                This will mark the order as <strong>Completed</strong> and remove it from the active queue.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Completed By <span style={{ color: '#c0392b' }}>*</span></label>
                <input style={inputStyle} value={completedBy} onChange={e => setCompletedBy(e.target.value)} placeholder="Your name" autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Close-Out Notes (optional)</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Any notes to record..." />
              </div>
            </div>
          )}

          {/* Cancel Form */}
          {mode === 'cancel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '10px 14px', background: '#fdecec', border: '1px solid #f5b7b1', borderRadius: 8, fontSize: 13, color: '#c0392b' }}>
                This will mark the order as <strong>Cancelled</strong>. Please record the reason.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Cancel Reason <span style={{ color: '#c0392b' }}>*</span></label>
                <select style={inputStyle} value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                  <option value="">— select reason —</option>
                  {CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Cancel Source (who requested?)</label>
                <input style={inputStyle} value={cancelSource} onChange={e => setCancelSource(e.target.value)} placeholder="e.g. Customer, Tech, Service Manager" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Notes (optional)</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Additional context..." />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {mode === 'choose' ? (
            <button className="btn" onClick={onClose}>Cancel</button>
          ) : (
            <>
              <button className="btn" onClick={() => setMode('choose')}>← Back</button>
              <button className="btn" onClick={onClose}>Cancel</button>
              {mode === 'closeout' ? (
                <button className="btn btn-primary" style={{ background: '#1a9e6a' }} disabled={saving} onClick={handleCloseout}>
                  {saving ? 'Closing...' : 'Close Out Order'}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ background: '#c0392b' }} disabled={saving} onClick={handleCancel}>
                  {saving ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
