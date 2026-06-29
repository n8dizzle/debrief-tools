/**
 * Parse a Shearer Supply invoice CSV export into structured invoices + line items.
 *
 * Shape of the export: a header row, then one row per *event*. Invoice-level fields
 * (PO_NUMBER, INVOICE_NUMBER, totals, dates…) repeat on every row of that invoice;
 * line-item fields (PRODUCT_COL, NET_AMOUNT_COL…) are populated only on product rows.
 * A single file can contain several invoices. Pure — no I/O — so it's unit-testable.
 */

export interface ShearerLine {
  line_no: number | null;
  sku: string;
  description: string;
  uom: string;
  qty_ordered: number | null;
  qty_shipped: number | null;
  qty_backordered: number | null;
  unit_price: number | null;
  net_amount: number | null;
  is_return: boolean;
}
export interface ShearerInvoice {
  doc_type: string;
  invoice_number: string;
  order_number: string;
  po_number: string;
  estimate_job_number: string | null;
  account_number: string;
  salesperson: string;
  ship_to: string;
  order_date: string | null;
  invoice_date: string | null;
  due_date: string | null;
  merchandise: number | null;
  freight: number | null;
  service_charge: number | null;
  subtotal: number | null;
  sales_tax: number | null;
  total_due: number | null;
  lines: ShearerLine[];
}

/** Normalize a SKU for cross-system matching: uppercase, strip non-alphanumeric. */
export function normalizeSku(s: string | null | undefined): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Do two SKUs refer to the same product across Shearer and ServiceTitan? ST often stores
 * a base SKU ("5A7A4036A") while Shearer adds a model suffix ("5A7A4036A1000A"), so we
 * match on exact-equal OR one being a prefix of the other (with a ≥6-char floor to avoid
 * spurious short matches).
 */
export function skuMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeSku(a), y = normalizeSku(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  return short.length >= 6 && long.startsWith(short);
}

/** RFC-4180-ish CSV → rows of cells. Handles quoted fields, embedded commas, "" escapes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // strip a leading BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      // skip fully-empty trailing rows
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim().replace(/[$,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "06/25/2026" → "2026-06-25" (date-only, no timezone conversion). Empty → null. */
function mmddyyyy(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** A PO that is purely digits (>=5) is a ServiceTitan job #; otherwise it's a label like WARRANTY/stock. */
function estimateJobNumber(po: string): string | null {
  const s = (po || '').trim();
  return /^\d{5,}$/.test(s) ? s : null;
}

export function parseShearerCsv(text: string): ShearerInvoice[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });
  const get = (r: string[], key: string) => (idx[key] != null ? (r[idx[key]] ?? '').trim() : '');

  const byInvoice = new Map<string, ShearerInvoice>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const invNo = get(r, 'INVOICE_NUMBER');
    if (!invNo) continue;

    let inv = byInvoice.get(invNo);
    if (!inv) {
      const po = get(r, 'PO_NUMBER');
      inv = {
        doc_type: get(r, 'DOC_TYPE'),
        invoice_number: invNo,
        order_number: get(r, 'ORDER_NUMBER'),
        po_number: po,
        estimate_job_number: estimateJobNumber(po),
        account_number: get(r, 'ACCOUNT_NUMBER'),
        salesperson: get(r, 'SALESPERSON'),
        ship_to: get(r, 'SHIPPING_ADDRESS'),
        order_date: mmddyyyy(get(r, 'ORDER_DATE')),
        invoice_date: mmddyyyy(get(r, 'INVOICE_DATE')),
        due_date: mmddyyyy(get(r, 'DUE_DATE')),
        merchandise: num(get(r, 'MERCHANDISE')),
        freight: num(get(r, 'FREIGHT')),
        service_charge: num(get(r, 'SERVICE_CHARGE')),
        subtotal: num(get(r, 'SUBTOTAL')),
        sales_tax: num(get(r, 'SALES_TAX')),
        total_due: num(get(r, 'TOTAL_DUE')),
        lines: [],
      };
      byInvoice.set(invNo, inv);
    }

    const sku = get(r, 'PRODUCT_COL');
    if (sku) {
      const net = num(get(r, 'NET_AMOUNT_COL'));
      inv.lines.push({
        line_no: get(r, 'LINE_COL') ? Number(get(r, 'LINE_COL')) || null : null,
        sku,
        description: get(r, 'DESC_COL'),
        uom: get(r, 'UOM_COL'),
        qty_ordered: num(get(r, 'QTY_ORDER_COL')),
        qty_shipped: num(get(r, 'QTY_SHIP_COL')),
        qty_backordered: num(get(r, 'QTY_BO_COL')),
        unit_price: num(get(r, 'UNIT_PRICE_COL')),
        net_amount: net,
        is_return: net != null && net < 0,
      });
    }
  }
  return Array.from(byInvoice.values());
}
