'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency, formatDate } from '@/lib/ap-utils';
import AdminTable, { AdminColumn } from '@/components/AdminTable';

interface Line {
  id: string; line_no: number | null; sku: string | null; description: string | null;
  uom: string | null; qty_ordered: number | null; qty_shipped: number | null;
  qty_backordered: number | null; unit_price: number | null; net_amount: number | null; is_return: boolean;
}
interface Invoice {
  id: string; vendor: string; doc_type: string | null; invoice_number: string;
  order_number: string | null; po_number: string | null; estimate_job_number: string | null;
  salesperson: string | null; ship_to: string | null;
  order_date: string | null; invoice_date: string | null; due_date: string | null;
  merchandise: number | null; freight: number | null; sales_tax: number | null; total_due: number | null;
  lines: Line[];
}
type View = 'invoices' | 'lines' | 'validate';
type LinkFilter = 'all' | 'linked' | 'unlinked';
interface ValLine { sku: string | null; description: string | null; shearer_cost: number | null; st_cost: number | null; variance: number | null; is_return?: boolean; only?: 'shearer' | 'st'; }
interface ValRow {
  invoice_id: string; invoice_number: string; estimate_job_number: string; invoice_date: string | null;
  shearer_total: number; st_total: number | null; st_status: string | null; st_estimate_id: number | null;
  variance: number | null; matched_to_st: boolean; lines: ValLine[];
}
interface FlatLine extends Line { invoice_number: string; estimate_job_number: string | null; vendor: string; invoice_date: string | null; }

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}

export default function EquipmentPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [vendor, setVendor] = useState('');
  const [view, setView] = useState<View>('invoices');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [valRows, setValRows] = useState<ValRow[] | null>(null);
  const [valLoading, setValLoading] = useState(false);
  const [valExpanded, setValExpanded] = useState<string | null>(null);

  const canManage = perms.canManagePayments;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      if (vendor) p.set('vendor', vendor);
      const res = await fetch(`/api/supplier-invoices?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      setInvoices(data.invoices || []);
      setVendors(data.vendors || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [range, vendor]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);

  // Validation pulls live ServiceTitan estimates; fetch on demand when the view opens or dates change.
  useEffect(() => {
    if (view !== 'validate' || perms.isLoading) return;
    setValLoading(true); setValExpanded(null);
    const p = new URLSearchParams({ start: range.start, end: range.end });
    fetch(`/api/supplier-invoices/validate?${p.toString()}`)
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setValRows(d.rows || []))
      .catch(() => setValRows([]))
      .finally(() => setValLoading(false));
  }, [view, range.start, range.end, perms.isLoading]);

  const onUpload = async (file: File) => {
    setUploading(true); setUploadMsg(null); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('vendor', 'Shearer');
      const res = await fetch('/api/supplier-invoices/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Upload failed');
      setUploadMsg(`Imported ${j.invoices} invoice${j.invoices === 1 ? '' : 's'} (${j.created} new, ${j.updated} updated), ${j.lines} lines.${j.errors ? ' Some rows had errors.' : ''}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const matchesSearch = (i: Invoice) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if ((i.invoice_number || '').toLowerCase().includes(q) || (i.po_number || '').toLowerCase().includes(q)) return true;
    return i.lines.some(l => (l.sku || '').toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q));
  };
  const passesLink = (i: Invoice) =>
    linkFilter === 'all' || (linkFilter === 'linked' ? !!i.estimate_job_number : !i.estimate_job_number);

  const filteredInvoices = useMemo(
    () => invoices.filter(i => passesLink(i) && matchesSearch(i)),
    [invoices, linkFilter, search]
  );
  const flatLines = useMemo<FlatLine[]>(() => {
    const q = search.trim().toLowerCase();
    const out: FlatLine[] = [];
    for (const i of invoices) {
      if (!passesLink(i)) continue;
      for (const l of i.lines) {
        if (q && !((l.sku || '').toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
          || (i.invoice_number || '').toLowerCase().includes(q) || (i.po_number || '').toLowerCase().includes(q))) continue;
        out.push({ ...l, invoice_number: i.invoice_number, estimate_job_number: i.estimate_job_number, vendor: i.vendor, invoice_date: i.invoice_date });
      }
    }
    return out;
  }, [invoices, linkFilter, search]);

  const totalMerch = filteredInvoices.reduce((s, i) => s + (i.merchandise || 0), 0);
  const totalTax = filteredInvoices.reduce((s, i) => s + (i.sales_tax || 0), 0);
  const linkedCount = filteredInvoices.filter(i => i.estimate_job_number).length;

  const invoiceCols = useMemo<AdminColumn<Invoice>[]>(() => [
    { key: 'invoice_number', label: 'Invoice #', sortable: true, width: 110, sortValue: r => r.invoice_number, render: r => <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.invoice_number}</span>, footer: rows => <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Totals · {rows.length}</span> },
    { key: 'est_job', label: 'Est Job # (PO)', sortable: true, width: 130, sortValue: r => r.estimate_job_number || r.po_number || '', render: r => r.estimate_job_number
        ? <span className="tabular-nums" style={{ color: '#6fd394' }}>{r.estimate_job_number}</span>
        : <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(210,153,34,.14)', color: '#d29922' }}>{r.po_number || '—'}</span> },
    { key: 'invoice_date', label: 'Invoice Date', sortable: true, width: 110, sortValue: r => r.invoice_date || '', render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.invoice_date ? formatDate(r.invoice_date) : '—'}</span> },
    { key: 'salesperson', label: 'Salesperson', sortable: true, width: 100, sortValue: r => r.salesperson || '', render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.salesperson || '—'}</span> },
    { key: 'lines', label: 'Lines', sortable: true, align: 'right', width: 70, sortValue: r => r.lines.length, render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.lines.length}</span> },
    { key: 'merchandise', label: 'Merchandise', sortable: true, align: 'right', width: 120, sortValue: r => r.merchandise ?? 0, render: r => <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.merchandise || 0)}</span>, footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.merchandise || 0), 0)) },
    { key: 'sales_tax', label: 'Tax', sortable: true, align: 'right', width: 100, sortValue: r => r.sales_tax ?? 0, render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(r.sales_tax || 0)}</span>, footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.sales_tax || 0), 0)) },
    { key: 'total_due', label: 'Total Due', sortable: true, align: 'right', width: 120, sortValue: r => r.total_due ?? 0, render: r => <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.total_due || 0)}</span>, footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.total_due || 0), 0)) },
  ], []);

  const lineCols = useMemo<AdminColumn<FlatLine>[]>(() => [
    { key: 'sku', label: 'SKU', sortable: true, width: 140, sortValue: r => r.sku || '', render: r => <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.sku || '—'}</span>, footer: rows => <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Totals · {rows.length}</span> },
    { key: 'description', label: 'Description', sortable: true, width: 240, sortValue: r => r.description || '', render: r => <span className="truncate block" style={{ color: 'var(--text-secondary)' }} title={r.description || ''}>{r.description || '—'}</span> },
    { key: 'est_job', label: 'Est Job #', sortable: true, width: 110, sortValue: r => r.estimate_job_number || '', render: r => r.estimate_job_number ? <span className="tabular-nums" style={{ color: '#6fd394' }}>{r.estimate_job_number}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'invoice_number', label: 'Invoice #', sortable: true, width: 100, sortValue: r => r.invoice_number, render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.invoice_number}</span> },
    { key: 'qty', label: 'Qty', sortable: true, align: 'right', width: 70, sortValue: r => r.qty_shipped ?? 0, render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.qty_shipped ?? '—'}</span>, footer: rows => String(rows.reduce((s, r) => s + (r.qty_shipped || 0), 0)) },
    { key: 'unit_price', label: 'Unit $', sortable: true, align: 'right', width: 100, sortValue: r => r.unit_price ?? 0, render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.unit_price != null ? formatCurrency(r.unit_price) : '—'}</span> },
    { key: 'net_amount', label: 'Net $', sortable: true, align: 'right', width: 110, sortValue: r => r.net_amount ?? 0, render: r => <span className="tabular-nums font-semibold" style={{ color: r.is_return ? '#f85149' : 'var(--text-primary)' }}>{formatCurrency(r.net_amount || 0)}</span>, footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.net_amount || 0), 0)) },
  ], []);

  if (!perms.isLoading && !perms.canManagePayments) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view supplier invoices.</div>;
  }

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };
  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Equipment &amp; Materials</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(210,153,34,.16)', color: '#d29922' }}>Supplier invoices</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Imported supplier invoices (Shearer). PO = ServiceTitan sales estimate job #. Validation against ServiceTitan pricing comes next.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-1">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" />
        {vendors.length > 1 && (
          <select value={vendor} onChange={e => setVendor(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={selectStyle}>
            <option value="">All vendors</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        <input type="text" placeholder="Search PO, invoice, SKU, description…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 240 }} />
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {([['all', 'All'], ['linked', 'Job-linked'], ['unlinked', 'No job']] as [LinkFilter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setLinkFilter(f)} className="px-3 py-1 rounded text-sm"
              style={{ backgroundColor: linkFilter === f ? 'var(--christmas-green)' : 'transparent', color: linkFilter === f ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {([['invoices', 'Invoices'], ['lines', 'Line Items'], ['validate', 'Validation']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1 rounded text-sm"
              style={{ backgroundColor: view === v ? 'var(--christmas-green)' : 'transparent', color: view === v ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>{label}</button>
          ))}
        </div>
        {canManage && (
          <label className="ml-auto rounded-lg px-3 py-2 text-sm font-medium cursor-pointer" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>
            {uploading ? 'Importing…' : '↑ Upload Shearer CSV'}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          </label>
        )}
      </div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>Date filter = invoice date.</div>

      {uploadMsg && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(58,143,87,0.12)', border: '1px solid var(--christmas-green)', color: '#6fd394' }}>{uploadMsg}</div>}
      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Invoices</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{filteredInvoices.length}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{flatLines.length} line items</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Merchandise</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalMerch)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>pre-tax</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sales Tax</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalTax)}</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Linked to a Job</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{linkedCount}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>of {filteredInvoices.length} via numeric PO</div>
        </div>
      </div>

      {view === 'validate' ? (
        valLoading ? (
          <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Checking ServiceTitan estimates…</div>
        ) : !valRows || valRows.length === 0 ? (
          <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>No job-linked invoices in this range to validate. (PO must be a numeric estimate job #.)</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {([['PO / Est Job #', 'left'], ['Invoice #', 'left'], ['ServiceTitan', 'left'], ['Shearer $', 'right'], ['ST Equip $', 'right'], ['Variance', 'right']] as [string, string][]).map(([l, a], i) => (
                    <th key={i} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', textAlign: a as any, whiteSpace: 'nowrap' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {valRows.map(r => {
                  const open = valExpanded === r.invoice_id;
                  const vpct = r.st_total && r.st_total !== 0 && r.variance != null ? (r.variance / r.st_total) * 100 : null;
                  const vcolor = r.variance == null ? 'var(--text-muted)' : Math.abs(r.variance) < 0.5 ? '#6fd394' : r.variance > 0 ? '#f85149' : '#d29922';
                  return (
                    <ValTableRow key={r.invoice_id} r={r} open={open} vpct={vpct} vcolor={vcolor} onToggle={() => setValExpanded(open ? null : r.invoice_id)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>
          No supplier invoices yet.{canManage ? ' Upload a Shearer CSV to get started.' : ''}
        </div>
      ) : view === 'invoices' ? (
        <AdminTable<Invoice> tableId="supplier-invoices" columns={invoiceCols} rows={filteredInvoices} rowKey={r => r.id} showSearch={false} emptyMessage="No invoices match these filters." />
      ) : (
        <AdminTable<FlatLine> tableId="supplier-lines" columns={lineCols} rows={flatLines} rowKey={r => r.id} showSearch={false} emptyMessage="No line items match these filters." />
      )}
      {view === 'validate' && (
        <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Compares Shearer actual cost vs the ServiceTitan estimate&apos;s listed equipment cost (item cost, not sell). Variance = Shearer − ST: <span style={{ color: '#f85149' }}>red = paid more than ST listed</span>, <span style={{ color: '#d29922' }}>amber = paid less</span>, <span style={{ color: '#6fd394' }}>green = matches</span>. Lines matched by SKU.
        </div>
      )}
    </div>
  );
}

function ValTableRow({ r, open, vpct, vcolor, onToggle }: {
  r: ValRow; open: boolean; vpct: number | null; vcolor: string; onToggle: () => void;
}) {
  const money = (n: number | null) => n == null ? '—' : formatCurrency(n);
  return (
    <Fragment>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <td className="px-3 py-2.5 text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginRight: 6 }}>{open ? '▾' : '▸'}</span>{r.estimate_job_number}
        </td>
        <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.invoice_number}</td>
        <td className="px-3 py-2.5 text-sm">
          {r.matched_to_st
            ? (r.st_estimate_id
                ? <a href={`https://go.servicetitan.com/#/Job/Index/${r.estimate_job_number}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:underline" style={{ color: 'var(--christmas-green)' }}>{r.st_status || 'estimate'}</a>
                : <span style={{ color: 'var(--text-secondary)' }}>{r.st_status}</span>)
            : <span style={{ color: '#d29922' }}>no estimate found</span>}
        </td>
        <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(r.shearer_total)}</td>
        <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{money(r.st_total)}</td>
        <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold" style={{ color: vcolor }}>
          {r.variance == null ? '—' : `${r.variance > 0 ? '+' : ''}${formatCurrency(r.variance)}`}
          {vpct != null && <span className="text-[11px] font-normal" style={{ opacity: 0.8 }}> ({vpct > 0 ? '+' : ''}{vpct.toFixed(0)}%)</span>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="px-3 pb-3 pt-0" style={{ backgroundColor: 'rgba(58,143,87,.04)' }}>
            <table className="w-full mt-1" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 8 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  {([['SKU', 'left'], ['Description', 'left'], ['Shearer $', 'right'], ['ST $', 'right'], ['Variance', 'right']] as [string, string][]).map(([l, a], i) => (
                    <th key={i} className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ textAlign: a as any }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {l.sku || '—'}{l.is_return && <span className="ml-1" style={{ color: '#f85149' }}>(return)</span>}
                      {l.only === 'shearer' && <span className="ml-1 text-[10px]" style={{ color: '#d29922' }}>Shearer only</span>}
                      {l.only === 'st' && <span className="ml-1 text-[10px]" style={{ color: '#5aa9e6' }}>ST only</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{l.description || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{l.shearer_cost == null ? '—' : formatCurrency(l.shearer_cost)}</td>
                    <td className="px-2.5 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{l.st_cost == null ? '—' : formatCurrency(l.st_cost)}</td>
                    <td className="px-2.5 py-1.5 text-xs text-right tabular-nums font-semibold"
                      style={{ color: l.variance == null ? 'var(--text-muted)' : Math.abs(l.variance) < 0.5 ? '#6fd394' : l.variance > 0 ? '#f85149' : '#d29922' }}>
                      {l.variance == null ? '—' : `${l.variance > 0 ? '+' : ''}${formatCurrency(l.variance)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
