'use client';
import { useState, useRef, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { TECHS, LOCATIONS, INSTALL_LOCATIONS, SVC_SUBTYPES, INST_SUBTYPES } from '@/lib/constants';
import { formatLocalDate } from '@/lib/pe-utils';

interface Props {
  onClose: () => void;
}

type OrderStep1Type = 'service' | 'install' | 'duct';
type Step = 1 | 2;

export default function NewOrderWizard({ onClose }: Props) {
  const { createOrder, showToast, suppliers } = useOrders();
  const [step, setStep] = useState<Step>(1);
  const [orderType, setOrderType] = useState<OrderStep1Type | null>(null);
  const [saving, setSaving] = useState(false);

  const today = formatLocalDate(new Date());

  // Service fields
  const [sJob, setSJob] = useState('');
  const [sTech, setSTech] = useState('');
  const [sCustomer, setSCustomer] = useState('');
  const [sSubtype, setSSubtype] = useState('');
  const [sPart, setSPart] = useState('');
  const [sSupplier, setSSupplier] = useState('');
  const [sEstCost, setSEstCost] = useState('');
  const [sWarranty, setSWarranty] = useState('No');
  const [sWarrantyType, setSWarrantyType] = useState('');
  const [sNoteWH, setSNoteWH] = useState('');
  const [sNoteCXR, setSNoteCXR] = useState('');
  const [sIsEquip, setSIsEquip] = useState(false);

  // Install fields
  const [iJob, setIJob] = useState('');
  const [iTech, setITech] = useState('');
  const [iCustomer, setICustomer] = useState('');
  const [iSubtype, setISubtype] = useState('');
  const [iPart, setIPart] = useState('');
  const [iSupplier, setISupplier] = useState('');
  const [iEquipCost, setIEquipCost] = useState('');
  const [iJobCost, setIJobCost] = useState('');
  const [iTeam, setITeam] = useState('');
  const [iNote, setINote] = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function selectType(t: OrderStep1Type) {
    setOrderType(t);
    setStep(2);
  }

  async function submitService() {
    if (!sJob.trim()) { showToast('Job number is required', 'error'); return; }
    setSaving(true);
    try {
      await createOrder({
        date: today,
        order_type: 'service',
        subtype: sSubtype,
        job: sJob.trim(),
        tech: sTech,
        customer: sCustomer.trim(),
        part: sPart.trim(),
        supplier: sSupplier,
        estimate_cost: sEstCost,
        warranty: sWarranty,
        warranty_type: sWarrantyType,
        note_wh: sNoteWH.trim(),
        note_cxr: sNoteCXR.trim(),
        is_equipment: sIsEquip,
        status: 'open',
        owner: 'Service Dispatcher',
        location: sPart.trim() ? 'Place Order' : '',
        needs_order: !!sPart.trim(),
      });
      showToast('Service order created');
      onClose();
    } catch {
      showToast('Failed to create order', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitInstall() {
    if (!iJob.trim()) { showToast('Job number is required', 'error'); return; }
    setSaving(true);
    try {
      await createOrder({
        date: today,
        order_type: 'install',
        subtype: iSubtype,
        job: iJob.trim(),
        tech: iTech,
        customer: iCustomer.trim(),
        part: iPart.trim(),
        supplier: iSupplier,
        equip_cost: iEquipCost,
        job_cost: iJobCost,
        install_team: iTeam,
        note_wh: iNote.trim(),
        status: 'open',
        owner: 'Install Manager',
        location: iPart.trim() ? 'Place Order' : '',
        needs_order: !!iPart.trim(),
      });
      showToast('Install order created');
      onClose();
    } catch {
      showToast('Failed to create order', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitDuct() {
    if (!sJob.trim()) { showToast('Job number is required', 'error'); return; }
    setSaving(true);
    try {
      await createOrder({
        date: today,
        order_type: 'service',
        subtype: 'Duct Cleaning',
        job: sJob.trim(),
        tech: sTech,
        customer: sCustomer.trim(),
        note_cxr: sNoteCXR.trim(),
        status: 'open',
        owner: 'CXR Team',
        location: 'Duct Cleaning - Schedule',
        needs_order: false,
      });
      showToast('Duct cleaning order created');
      onClose();
    } catch {
      showToast('Failed to create order', 'error');
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' };
  const groupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="modal-card wizard-card">

        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>New Order</div>
            {step === 2 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {orderType === 'service' ? 'Service Order' : orderType === 'install' ? 'Install Order' : 'Duct Cleaning'}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>What type of order are you creating?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="wizard-type-btn" onClick={() => selectType('service')}>
                  <div className="wizard-type-icon" style={{ background: '#1565c0' }}>⚡</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Service Order</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Parts for service/repair jobs — repairs, HVAC service, plumbing</div>
                  </div>
                </button>
                <button className="wizard-type-btn" onClick={() => selectType('install')}>
                  <div className="wizard-type-icon" style={{ background: '#7a1c2e' }}>🔧</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Install Order</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Equipment and parts for installation jobs — new systems, replacements</div>
                  </div>
                </button>
                <button className="wizard-type-btn" onClick={() => selectType('duct')}>
                  <div className="wizard-type-icon" style={{ background: '#2d4a3e' }}>🌬</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Duct Cleaning</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Schedule duct cleaning — routes to CXR team queue</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2a: Service Form */}
          {step === 2 && orderType === 'service' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>Job # <span style={{ color: '#c0392b' }}>*</span></label>
                  <input style={inputStyle} value={sJob} onChange={e => setSJob(e.target.value)} placeholder="e.g. 12345678" autoFocus />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Customer</label>
                  <input style={inputStyle} value={sCustomer} onChange={e => setSCustomer(e.target.value)} placeholder="Customer name" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Sold By (Tech)</label>
                  <select style={inputStyle} value={sTech} onChange={e => setSTech(e.target.value)}>
                    <option value="">— select tech —</option>
                    {TECHS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Service Type</label>
                  <select style={inputStyle} value={sSubtype} onChange={e => setSSubtype(e.target.value)}>
                    <option value="">— select type —</option>
                    {SVC_SUBTYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={groupStyle}>
                <label style={labelStyle}>Part / Description</label>
                <input style={inputStyle} value={sPart} onChange={e => setSPart(e.target.value)} placeholder="Part name or description" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>Supplier</label>
                  <select style={inputStyle} value={sSupplier} onChange={e => setSSupplier(e.target.value)}>
                    <option value="">— select —</option>
                    {suppliers.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Est. Cost</label>
                  <input style={inputStyle} value={sEstCost} onChange={e => setSEstCost(e.target.value)} placeholder="$0.00" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Warranty?</label>
                  <select style={inputStyle} value={sWarranty} onChange={e => setSWarranty(e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                    <option value="P">P</option>
                    <option value="L">L</option>
                    <option value="P/L">P/L</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>WH Notes</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} value={sNoteWH} onChange={e => setSNoteWH(e.target.value)} placeholder="Warehouse notes..." />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>CXR Notes</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} value={sNoteCXR} onChange={e => setSNoteCXR(e.target.value)} placeholder="CXR notes..." />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="isEquipCb" checked={sIsEquip} onChange={e => setSIsEquip(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                <label htmlFor="isEquipCb" style={{ fontSize: 13, cursor: 'pointer' }}>This is equipment (not just a part)</label>
              </div>
            </div>
          )}

          {/* Step 2b: Install Form */}
          {step === 2 && orderType === 'install' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>Job # <span style={{ color: '#c0392b' }}>*</span></label>
                  <input style={inputStyle} value={iJob} onChange={e => setIJob(e.target.value)} placeholder="e.g. 12345678" autoFocus />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Customer</label>
                  <input style={inputStyle} value={iCustomer} onChange={e => setICustomer(e.target.value)} placeholder="Customer name" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Sold By (Tech)</label>
                  <select style={inputStyle} value={iTech} onChange={e => setITech(e.target.value)}>
                    <option value="">— select tech —</option>
                    {['Brett', 'Christina', 'John', 'Luke', 'Mark', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Install Type</label>
                  <select style={inputStyle} value={iSubtype} onChange={e => setISubtype(e.target.value)}>
                    <option value="">— select type —</option>
                    {INST_SUBTYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={groupStyle}>
                <label style={labelStyle}>Equipment to Order</label>
                <input style={inputStyle} value={iPart} onChange={e => setIPart(e.target.value)} placeholder="Equipment description..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>Ordered From</label>
                  <select style={inputStyle} value={iSupplier} onChange={e => setISupplier(e.target.value)}>
                    <option value="">— select —</option>
                    {suppliers.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Equip. Cost</label>
                  <input style={inputStyle} value={iEquipCost} onChange={e => setIEquipCost(e.target.value)} placeholder="$0.00" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Job Cost</label>
                  <input style={inputStyle} value={iJobCost} onChange={e => setIJobCost(e.target.value)} placeholder="$0.00" />
                </div>
              </div>
              <div style={groupStyle}>
                <label style={labelStyle}>Install Team</label>
                <select style={inputStyle} value={iTeam} onChange={e => setITeam(e.target.value)}>
                  <option value="">— select team —</option>
                  <option>Brett &amp; Luke</option>
                  <option>Brett &amp; Mark</option>
                  <option>John &amp; Luke</option>
                  <option>John &amp; Mark</option>
                  <option>Sub</option>
                  <option>TBD</option>
                </select>
              </div>
              <div style={groupStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} value={iNote} onChange={e => setINote(e.target.value)} placeholder="Any notes about this order..." />
              </div>
            </div>
          )}

          {/* Step 2c: Duct Form (simple) */}
          {step === 2 && orderType === 'duct' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '10px 14px', background: '#eafaf1', border: '1px solid #a9dfbf', borderRadius: 8, fontSize: 13, color: '#1e8449' }}>
                This order will be sent to the CXR team to schedule duct cleaning.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={groupStyle}>
                  <label style={labelStyle}>Job # <span style={{ color: '#c0392b' }}>*</span></label>
                  <input style={inputStyle} value={sJob} onChange={e => setSJob(e.target.value)} placeholder="e.g. 12345678" autoFocus />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Customer</label>
                  <input style={inputStyle} value={sCustomer} onChange={e => setSCustomer(e.target.value)} placeholder="Customer name" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Sold By (Tech)</label>
                  <select style={inputStyle} value={sTech} onChange={e => setSTech(e.target.value)}>
                    <option value="">— select tech —</option>
                    {TECHS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={groupStyle}>
                <label style={labelStyle}>CXR Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={sNoteCXR} onChange={e => setSNoteCXR(e.target.value)} placeholder="Notes for CXR team..." />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 1 ? (
            <button className="btn" onClick={onClose}>Cancel</button>
          ) : (
            <>
              <button className="btn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={orderType === 'service' ? submitService : orderType === 'install' ? submitInstall : submitDuct}
              >
                {saving ? 'Creating...' : 'Create Order'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
