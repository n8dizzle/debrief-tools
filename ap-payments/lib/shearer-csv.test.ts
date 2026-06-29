import { describe, it, expect } from 'vitest';
import { parseCsv, parseShearerCsv } from './shearer-csv';

const HEADER = '"DOC_TYPE","SHIPPING_ADDRESS","ACCOUNT_NUMBER","ORDER_DATE","ORDER_NUMBER","ORDER_BY","PO_NUMBER","SHIP_VIA","SALESPERSON","INVOICE_NUMBER","INVOICE_DATE","SHIP_DATE","SHIPPING_DESC","JOB_NUMBER","TERMS","FOOTER_MESSAGE","MERCHANDISE","FREIGHT","SERVICE_CHARGE","SUBTOTAL","TAXABLE_AMT","SALES_TAX","TAX_NUMBER","TOTAL_DUE","DUE_DATE","WRITER","DISCOUNT_AMOUNT","LINE_COL","QTY_ORDER_COL","QTY_SHIP_COL","QTY_BO_COL","PRODUCT_COL","DESC_COL","UOM_COL","UNIT_PRICE_COL","NET_AMOUNT_COL","MESSAGE_COL","CMT_USER_DEFINE1_COL","TRACKING_NUM_COL","PAYMENT_DESC_COL","PAYMENT_AMT_COL"';

// invoice header repeated; one message row (no product) + two product rows incl. a return
function line(po: string, inv: string, product: string, qty: string, net: string, msg = '') {
  return `"INVOICE","BART'S, ARGYLE TX","0011947","06/25/2026","${inv}","John","${po}","HOTSHOT","201","${inv}","06/26/2026","06/26/2026","PREPAID","","NET 45","footer, with comma","9115.00","0.00","0.00","9115.00","9115.00","751.99","(05249)","9866.99","08/10/2026","TGZ","0.00","1","${qty}","${qty}","0","${product}","454b ""Model"" - AMSTD","EA","1460.0000","${net}","${msg}","","","",""`;
}

describe('parseCsv', () => {
  it('handles quoted commas and escaped quotes', () => {
    const rows = parseCsv('"a","b, c","d""e"\n"1","2","3"');
    expect(rows[0]).toEqual(['a', 'b, c', 'd"e']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });
});

describe('parseShearerCsv', () => {
  const csv = [
    HEADER,
    line('184452028', 'DE017842', '', '', '', '**** Invoice Message ****'), // noise row, no product
    line('184452028', 'DE017842', '5A7A4036A1000A', '1', '1460.00'),
    line('184452028', 'DE017842', 'VAL12308', '-1', '-207.81'),               // return
    line('WARRANTY', 'DE017845', 'SEN03269', '5', '740.90'),                  // non-job PO
  ].join('\n');
  const invoices = parseShearerCsv(csv);

  it('groups rows into invoices', () => {
    expect(invoices.length).toBe(2);
  });
  it('parses the estimate job # from a numeric PO, null for WARRANTY', () => {
    const a = invoices.find(i => i.invoice_number === 'DE017842')!;
    const b = invoices.find(i => i.invoice_number === 'DE017845')!;
    expect(a.estimate_job_number).toBe('184452028');
    expect(a.po_number).toBe('184452028');
    expect(b.estimate_job_number).toBeNull();
    expect(b.po_number).toBe('WARRANTY');
  });
  it('only product rows become lines (message rows excluded)', () => {
    const a = invoices.find(i => i.invoice_number === 'DE017842')!;
    expect(a.lines.length).toBe(2);
    expect(a.lines.map(l => l.sku)).toEqual(['5A7A4036A1000A', 'VAL12308']);
  });
  it('flags returns by negative net', () => {
    const a = invoices.find(i => i.invoice_number === 'DE017842')!;
    expect(a.lines[1].is_return).toBe(true);
    expect(a.lines[1].net_amount).toBe(-207.81);
  });
  it('parses money + dates', () => {
    const a = invoices.find(i => i.invoice_number === 'DE017842')!;
    expect(a.merchandise).toBe(9115);
    expect(a.sales_tax).toBe(751.99);
    expect(a.total_due).toBe(9866.99);
    expect(a.invoice_date).toBe('2026-06-26');
    expect(a.due_date).toBe('2026-08-10');
  });
});
