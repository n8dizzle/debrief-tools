/**
 * CreatePOModal — 3-step flow to convert a restock batch into a draft PO.
 *
 * Steps:
 *   1. Vendor + delivery date selection
 *   2. Review / edit line items (pre-filled from approved batch lines)
 *   3. Confirm summary → submit
 *
 * Props:
 *   batch      — batch object (for dept, truck info)
 *   lines      — approved batch lines array
 *   onClose    — () => void
 *   onCreated  — (po) => void   called with the new PO on success
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, ShoppingCart, Truck,
  Calendar, Building2, Package, AlertTriangle, CheckCircle,
  Minus, Plus, Loader2, Zap,
} from 'lucide-react';
import client from '../api/client.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

function StepIndicator({ step }) {
  const steps = ['Vendor & Date', 'Line Items', 'Confirm'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx  = i + 1;
        const done = idx < step;
        const curr = idx === step;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done ? 'bg-indigo-600 border-indigo-600 text-white'
                       : curr ? 'bg-white border-indigo-500 text-indigo-600 ring-4 ring-indigo-50'
                              : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                {done ? <CheckCircle size={14} /> : idx}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap
                ${curr ? 'text-slate-700' : done ? 'text-indigo-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-10 h-0.5 mx-1 mb-4 ${done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Vendor + Date ─────────────────────────────────────────────────────
function StepVendor({ dept, vendor, setVendor, deliveryDate, setDeliveryDate, notes, setNotes, stPoNumber, setStPoNumber, onNext }) {
  const [vendors,  setVendors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    client.get('/vendors', { params: { department: dept } })
      .then(({ data }) => setVendors(data.vendors ?? []))
      .catch(() => setError('Could not load vendors'))
      .finally(() => setLoading(false));
  }, [dept]);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const canNext = vendor && deliveryDate;

  return (
    <div className="flex flex-col gap-5">
      {/* Vendor */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Vendor *</label>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
            <Loader2 size={16} className="animate-spin" /> Loading vendors…
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {vendors.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVendor(v)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors
                  ${vendor?.id === v.id
                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                                 ${vendor?.id === v.id ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                  <Building2 size={16} className={vendor?.id === v.id ? 'text-white' : 'text-slate-400'} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold text-sm ${vendor?.id === v.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                    {v.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {v.contact} · {v.email}
                  </p>
                  <p className="text-xs text-slate-400">
                    Lead time: {v.lead_days} day{v.lead_days !== 1 ? 's' : ''}
                  </p>
                </div>
                {vendor?.id === v.id && (
                  <CheckCircle size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expected delivery */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Expected Delivery Date *</label>
        <div className="relative">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            min={minDateStr}
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
        {vendor && deliveryDate && (
          <p className="text-xs text-slate-400 mt-1.5">
            Suggested: {(() => {
              const d = new Date();
              d.setDate(d.getDate() + vendor.lead_days);
              return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            })()}
            {' '}(based on {vendor.lead_days}-day lead time)
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Delivery instructions, special requests…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>

      {/* ST PO# (optional link) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Zap size={13} className="text-indigo-500" />
          ServiceTitan PO# <span className="text-xs font-normal text-slate-400 ml-1">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. ST-24-10042 — leave blank to generate on push"
          value={stPoNumber}
          onChange={e => setStPoNumber(e.target.value)}
          className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
        <p className="text-[11px] text-slate-400">
          Pre-link an existing ST purchase order, or push to ST later from the PO detail page.
        </p>
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700
                   disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition-colors"
      >
        Review Line Items <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step 2: Line Items ────────────────────────────────────────────────────────
function StepLineItems({ lineItems, setLineItems, onBack, onNext }) {
  function setQty(id, delta) {
    setLineItems(prev => prev.map(l =>
      l.id === id ? { ...l, qty_ordered: Math.max(1, (l.qty_ordered ?? 1) + delta) } : l
    ));
  }

  function setQtyDirect(id, val) {
    const n = parseInt(val);
    setLineItems(prev => prev.map(l =>
      l.id === id ? { ...l, qty_ordered: isNaN(n) || n < 1 ? 1 : n } : l
    ));
  }

  function removeItem(id) {
    setLineItems(prev => prev.filter(l => l.id !== id));
  }

  const total = lineItems.reduce((s, l) => s + (l.unit_cost * l.qty_ordered), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-slate-500 mb-3">
          {lineItems.length} line{lineItems.length !== 1 ? 's' : ''} from approved batch items.
          Adjust quantities or remove items as needed.
        </p>

        {lineItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No items remaining. Go back and check your batch.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
            {lineItems.map(line => (
              <div key={line.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                {/* Icon */}
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-indigo-500" />
                </div>

                {/* Name + SKU */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{line.name}</p>
                  <p className="text-xs text-slate-400">{line.sku} · {fmt(line.unit_cost)}/{line.unit ?? 'unit'}</p>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setQty(line.id, -1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={line.qty_ordered}
                    onChange={e => setQtyDirect(line.id, e.target.value)}
                    className="w-12 text-center text-sm border border-slate-200 rounded-lg py-1
                               focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(line.id, +1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Line total */}
                <p className="text-sm font-semibold text-slate-700 w-20 text-right flex-shrink-0">
                  {fmt(line.unit_cost * line.qty_ordered)}
                </p>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(line.id)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Subtotal */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
          <span className="text-sm text-slate-500">Estimated Total</span>
          <span className="text-lg font-bold text-slate-800">{fmt(total)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600
                     hover:bg-slate-50 rounded-xl py-3 font-semibold transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={lineItems.length === 0}
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700
                     disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition-colors"
        >
          Review & Confirm <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Confirm ───────────────────────────────────────────────────────────
function StepConfirm({ batch, vendor, deliveryDate, notes, lineItems, onBack, onSubmit, submitting, submitError }) {
  const total = lineItems.reduce((s, l) => s + (l.unit_cost * l.qty_ordered), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary card */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Vendor</p>
            <p className="font-semibold text-slate-800">{vendor?.name}</p>
            <p className="text-xs text-slate-500">{vendor?.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Expected Delivery</p>
            <p className="font-semibold text-slate-800">
              {new Date(deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Truck / Source</p>
            <p className="font-semibold text-slate-800">
              {batch.truck_number ? `Truck ${batch.truck_number} · ` : ''}{batch.warehouse_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Department</p>
            <p className="font-semibold text-slate-800 capitalize">{batch.department}</p>
          </div>
        </div>
        {notes && (
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-400 mb-0.5">Notes</p>
            <p className="text-sm text-slate-600 italic">"{notes}"</p>
          </div>
        )}
      </div>

      {/* Line summary */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {lineItems.length} Line Item{lineItems.length !== 1 ? 's' : ''}
        </p>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {lineItems.map(l => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <div>
                <p className="text-sm text-slate-800 font-medium">{l.name}</p>
                <p className="text-xs text-slate-400">{l.sku} · {l.qty_ordered} × {fmt(l.unit_cost)}</p>
              </div>
              <p className="text-sm font-semibold text-slate-700">{fmt(l.unit_cost * l.qty_ordered)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
            <p className="text-sm font-bold text-slate-700">Total</p>
            <p className="text-lg font-bold text-indigo-600">{fmt(total)}</p>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="flex-shrink-0" />{submitError}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600
                     hover:bg-slate-50 rounded-xl py-3 font-semibold transition-colors disabled:opacity-50">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                     disabled:opacity-60 text-white rounded-xl py-3 font-semibold transition-colors"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Creating PO…</>
            : <><ShoppingCart size={16} /> Create Draft PO</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ po, onClose, onView }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-500" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-800">PO Created!</h3>
        <p className="text-slate-500 mt-2 text-sm">
          <span className="font-semibold text-indigo-600">{po.po_number}</span> has been saved as a draft.
        </p>
        <p className="text-slate-400 text-xs mt-1">Open the PO to review and send it to your vendor.</p>
      </div>
      <div className="flex gap-3 w-full">
        <button onClick={onClose}
          className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-3 font-semibold text-sm">
          Stay Here
        </button>
        <button onClick={onView}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold text-sm">
          View PO →
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CreatePOModal({ batch, lines, onClose }) {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1 state
  const [vendor,       setVendor]       = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes,        setNotes]        = useState('');
  const [stPoNumber,   setStPoNumber]   = useState('');

  // Step 2 state — pre-fill from approved lines only
  const [lineItems, setLineItems] = useState(() =>
    lines
      .filter(l => l.status === 'approved')
      .map(l => ({
        id:          l.id,
        material_id: l.material_id,
        name:        l.material_name,
        sku:         l.sku,
        unit_cost:   l.unit_cost ?? 0,
        unit:        l.unit_of_measure ?? 'units',
        qty_ordered: l.quantity_approved ?? l.quantity_requested,
      }))
  );

  // Step 3 state
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [createdPO,    setCreatedPO]    = useState(null);

  async function submit() {
    setSubmitting(true); setSubmitError('');
    try {
      const { data } = await client.post('/purchase-orders', {
        vendor:            vendor.name,
        vendor_id:         vendor.id,
        vendor_email:      vendor.email,
        department:        batch.department,
        expected_delivery: deliveryDate,
        notes:             notes || undefined,
        source_batch_id:   batch.id,
        source_batch_num:  batch.batch_number,
        st_po_number:      stPoNumber || undefined,
        lines:             lineItems,
      });
      setCreatedPO(data.purchase_order);
      setStep('success');
    } catch (err) {
      setSubmitError(err.response?.data?.error ?? 'Failed to create PO. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const dept = batch.department ?? 'plumbing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <ShoppingCart size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Create Purchase Order</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Truck size={11} /> {batch.truck_number ? `Truck ${batch.truck_number} · ` : ''}{batch.warehouse_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step !== 'success' && <StepIndicator step={step} />}

          {step === 1 && (
            <StepVendor
              dept={dept}
              vendor={vendor}           setVendor={setVendor}
              deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate}
              notes={notes}             setNotes={setNotes}
              stPoNumber={stPoNumber}   setStPoNumber={setStPoNumber}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepLineItems
              lineItems={lineItems}
              setLineItems={setLineItems}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepConfirm
              batch={batch}
              vendor={vendor}
              deliveryDate={deliveryDate}
              notes={notes}
              lineItems={lineItems}
              onBack={() => setStep(2)}
              onSubmit={submit}
              submitting={submitting}
              submitError={submitError}
            />
          )}
          {step === 'success' && (
            <SuccessScreen
              po={createdPO}
              onClose={onClose}
              onView={() => navigate(`/purchase-orders/${createdPO.id}`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
