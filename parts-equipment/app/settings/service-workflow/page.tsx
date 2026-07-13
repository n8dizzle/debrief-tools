// Service parts-order workflow — reference doc for the team (Draft, to refine with
// their input). Install has its own separate flow (add a sibling page + a SECTIONS
// entry when ready). Static content; styling uses the app theme vars, scoped .swf-*.
const CSS = `
.swf{--auto:var(--accent);--team:var(--green);
  --pc:#00838f;--wh:#1976d2;--cxr:#6a0dad;--sd:#e65100;--sm:#2d6be4;--rachel:#1a9aaa;--id:#880e4f;
  color:var(--text);font-size:14px;line-height:1.5}
.swf h2.sec{font-size:18px;margin:34px 0 4px;padding-top:14px;border-top:1px solid var(--border);font-weight:800}
.swf .subttl{color:var(--muted);font-size:14px;margin:0 0 16px}
.swf .engines{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 18px}
.swf .engine{border-radius:var(--radius);padding:14px 16px;border:1px solid var(--border)}
.swf .engine.a{background:var(--accent-dim)}
.swf .engine.t{background:var(--green-dim)}
.swf .engine h3{margin:0 0 3px;font-size:14px;display:flex;align-items:center;gap:7px;font-weight:700}
.swf .engine p{margin:0;font-size:13px;color:var(--muted)}
.swf .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.swf .dot.a{background:var(--auto)}.swf .dot.t{background:var(--team)}
.swf .legend{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 6px;font-size:13px;color:var(--muted)}
.swf .legend span{display:inline-flex;align-items:center;gap:7px}
.swf .flow{margin-top:14px}
.swf .step{display:grid;grid-template-columns:40px 1fr;gap:14px;padding-bottom:12px}
.swf .rail{display:flex;flex-direction:column;align-items:center}
.swf .num{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex:0 0 auto}
.swf .num.a{background:var(--auto)}.swf .num.t{background:var(--team)}
.swf .num.mix{background:linear-gradient(135deg,var(--team) 50%,var(--auto) 50%)}
.swf .connector{width:2px;flex:1;background:var(--border2);margin:2px 0}
.swf .step:last-child .connector{display:none}
.swf .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;box-shadow:var(--shadow)}
.swf .who{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;display:inline-block;margin-bottom:7px}
.swf .who.a{color:var(--auto);background:var(--accent-dim)}
.swf .who.t{color:var(--green);background:var(--green-dim)}
.swf .who.mix{color:var(--muted);background:var(--surface3)}
.swf .card h4{margin:0 0 4px;font-size:15px;font-weight:700}
.swf .card p{margin:0;font-size:13.5px;color:var(--text)}
.swf .fields{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
.swf .chip{font-size:11.5px;padding:2px 8px;border-radius:var(--radius-sm);font-weight:600}
.swf .chip.a{background:var(--accent-dim);color:var(--auto)}
.swf .chip.t{background:var(--green-dim);color:var(--green)}
.swf .roles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:6px 0 20px}
.swf .role{background:var(--surface);border:1px solid var(--border);border-left-width:5px;border-radius:var(--radius);padding:11px 13px}
.swf .role h4{margin:0 0 2px;font-size:14px;font-weight:700}
.swf .role p{margin:0;font-size:12.5px;color:var(--muted)}
.swf .rpc{border-left-color:var(--pc)}.swf .rwh{border-left-color:var(--wh)}.swf .rcxr{border-left-color:var(--cxr)}
.swf .rsd{border-left-color:var(--sd)}.swf .rsm{border-left-color:var(--sm)}.swf .rr{border-left-color:var(--rachel)}
.swf .handoff{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:6px 0 8px}
.swf .pill{color:#fff;font-weight:700;font-size:12.5px;padding:5px 11px;border-radius:999px;white-space:nowrap}
.swf .pill.pc{background:var(--pc)}.swf .pill.wh{background:var(--wh)}.swf .pill.cxr{background:var(--cxr)}.swf .pill.done{background:var(--green)}
.swf .arrow{color:var(--muted);font-size:12px;font-weight:700}
.swf .arrow small{display:block;font-weight:600;font-size:10px;color:var(--muted2);text-transform:none}
.swf .branch{background:var(--amber-dim);border:1px solid rgba(212,138,10,0.3);border-radius:var(--radius);padding:12px 14px;margin:6px 0 16px}
.swf .branch b{color:var(--amber)}
.swf table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;font-size:13px;margin-top:8px}
.swf th,.swf td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top}
.swf th{background:var(--surface3);font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
.swf tr:last-child td{border-bottom:none}
.swf .ownertag{color:#fff;font-weight:700;font-size:11px;padding:1px 8px;border-radius:var(--radius-sm)}
.swf .ot-pc{background:var(--pc)}.swf .ot-wh{background:var(--wh)}.swf .ot-cxr{background:var(--cxr)}.swf .ot-sd{background:var(--sd)}.swf .ot-id{background:var(--id)}
.swf .tag{font-size:11px;font-weight:700;padding:1px 7px;border-radius:var(--radius-sm)}
.swf .tag.a{background:var(--accent-dim);color:var(--auto)}
.swf .q{background:var(--purple-dim);border:1px solid rgba(124,92,191,0.3);border-radius:var(--radius);padding:12px 14px;margin-top:14px;font-size:13px}
.swf .q b{color:var(--purple)}
.swf .q ul{margin:8px 0 0;padding-left:18px}.swf .q li{margin:4px 0}
.swf .draftnote{margin-top:22px;font-size:12.5px;color:var(--muted);border:1px dashed var(--border2);border-radius:var(--radius);padding:12px 14px}
@media(max-width:640px){.swf .engines,.swf .roles{grid-template-columns:1fr}}
`;

export default function ServiceWorkflowPage() {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="swf">
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 4px' }}>Service — Parts Order Workflow</h2>
        <p className="subttl">
          How a service parts order should move from ServiceTitan, through the team, and back to done.
          <strong> Draft — to refine with the team.</strong> (Install is a separate flow.)
        </p>

        <div className="engines">
          <div className="engine a"><h3><span className="dot a" /> ServiceTitan drives the ends</h3>
            <p>It decides when an order <strong>appears</strong> (estimate sold) and when it&apos;s <strong>done</strong> (job scheduled). Automatic.</p></div>
          <div className="engine t"><h3><span className="dot t" /> The team drives the middle</h3>
            <p>Assign it, order the part, chase it in, schedule the customer. The human work.</p></div>
        </div>

        <div className="legend">
          <span><span className="dot a" /> <strong>Automatic</strong> (ServiceTitan / sync)</span>
          <span><span className="dot t" /> <strong>Team</strong> (manual on the board)</span>
        </div>

        <div className="flow">
          <div className="step"><div className="rail"><div className="num a">0</div><div className="connector" /></div>
            <div className="card"><span className="who a">ServiceTitan</span>
              <h4>Estimate sold, not yet scheduled</h4>
              <p>A tech sells an estimate; the customer approves it but the repair isn&apos;t booked — usually waiting on a part. It lands on <strong>Report&nbsp;#54646792</strong>.</p></div></div>
          <div className="step"><div className="rail"><div className="num a">1</div><div className="connector" /></div>
            <div className="card"><span className="who a">Automatic · every 15 min</span>
              <h4>The sync creates the order</h4>
              <p>Reads the report and drops a new row on the board, pre-filled from ServiceTitan. Starts at Location &ldquo;Place Order&rdquo;.</p>
              <div className="fields">{['Date','Job #','Sold By','Customer','Est. Cost','Type','Part / Description'].map(f => <span className="chip a" key={f}>{f}</span>)}</div></div></div>
          <div className="step"><div className="rail"><div className="num t">2</div><div className="connector" /></div>
            <div className="card"><span className="who t">Team</span>
              <h4>Ownership + order the part</h4>
              <p>The ticket routes to an owner and moves through the parts team (detailed below). They pick the supplier, record the order number and cost, and mark it ordered.</p>
              <div className="fields">{['Owner','Supplier','Order #','Cost','✓ Parts Ordered'].map(f => <span className="chip t" key={f}>{f}</span>)}</div></div></div>
          <div className="step"><div className="rail"><div className="num t">3</div><div className="connector" /></div>
            <div className="card"><span className="who t">Team</span>
              <h4>Track it in &amp; chase the customer</h4>
              <p>Watch the ETA, move the Location as the part travels, handle backorders, keep the running call/text log, and mark it when it lands at the shop.</p>
              <div className="fields">{['ETA','Location','Cust. Informed B/O','Parts at Shop','2 Techs?','WH / CXR Notes'].map(f => <span className="chip t" key={f}>{f}</span>)}</div></div></div>
          <div className="step"><div className="rail"><div className="num mix">4</div><div className="connector" /></div>
            <div className="card"><span className="who mix">Team → ServiceTitan</span>
              <h4>Schedule the customer</h4>
              <p>Part&apos;s in — book the repair appointment in ServiceTitan. Hand-off back to automation.</p></div></div>
          <div className="step"><div className="rail"><div className="num a">5</div></div>
            <div className="card"><span className="who a">Automatic</span>
              <h4>Order auto-completes</h4>
              <p>Booking the job removes its estimate from the report. Next sync marks the order <strong>Complete</strong> and it drops off the open board.</p>
              <div className="fields"><span className="chip a">Status → Completed</span></div></div></div>
        </div>

        <h2 className="sec">The owner hand-off</h2>
        <p className="subttl">&ldquo;Owner&rdquo; isn&apos;t just a manual pick — the board <strong>auto-reassigns</strong> it as you change the <strong>Location</strong> or tick a <strong>checkbox</strong>. Each owner is who&apos;s responsible at that moment.</p>

        <div className="roles">
          <div className="role rpc"><h4>Parts Coordinator</h4><p>Places (and re-orders) the part. Owns it while it&apos;s being ordered.</p></div>
          <div className="role rwh"><h4>Warehouse</h4><p>Owns it in transit / at pickup — receiving the part.</p></div>
          <div className="role rcxr"><h4>CXR Team</h4><p>Customer-facing: schedules the repair, handles backorder comms, owns it once parts are at the shop.</p></div>
          <div className="role rsd"><h4>Service Dispatcher</h4><p>Owns it at the Lewisville shop stage.</p></div>
          <div className="role rsm"><h4>Service Manager</h4><p>An owner option, but nothing auto-routes here today — manual escalation only.</p></div>
          <div className="role rr"><h4>Rachel</h4><p>An owner option, manual only (e.g. duct-cleaning coordination).</p></div>
        </div>

        <h4 style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 700 }}>Typical path (part in stock / arrives normally)</h4>
        <div className="handoff">
          <span className="pill pc">Parts Coordinator</span>
          <span className="arrow">→<small>part ships</small></span>
          <span className="pill wh">Warehouse</span>
          <span className="arrow">→<small>✓ Parts at Shop</small></span>
          <span className="pill cxr">CXR Team</span>
          <span className="arrow">→<small>scheduled</small></span>
          <span className="pill done">Done (auto)</span>
        </div>

        <div className="branch"><b>Backorder detour</b>
          <div className="handoff" style={{ marginTop: 8 }}>
            <span className="pill cxr">CXR Team</span>
            <span className="arrow">→<small>✓ Cust. Informed</small></span>
            <span className="pill pc">Parts Coordinator</span>
            <span className="arrow">→<small>arrives ✓ Parts at Shop</small></span>
            <span className="pill cxr">CXR Team</span>
            <span className="arrow">→<small>scheduled</small></span>
            <span className="pill done">Done</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>Ticking <b>Part B/O</b> sets Location = &ldquo;Backordered&rdquo; and hands it to CXR Team to work the customer; once the customer&apos;s been told, it goes back to Parts Coordinator to keep chasing the part.</p>
        </div>

        <h4 style={{ margin: '18px 0 4px', fontSize: 14.5, fontWeight: 700 }}>What triggers each hand-off</h4>
        <table>
          <tbody>
            <tr><th>When you set…</th><th>Owner becomes</th></tr>
            <tr><td><b>Location</b> → Place Order · Cancel PO · Shipping to Supplier</td><td><span className="ownertag ot-pc">Parts Coordinator</span></td></tr>
            <tr><td><b>Location</b> → Shipping to Shop · P/U Supply House</td><td><span className="ownertag ot-wh">Warehouse</span></td></tr>
            <tr><td><b>Location</b> → Lewisville Shop</td><td><span className="ownertag ot-sd">Service Dispatcher</span></td></tr>
            <tr><td><b>Location</b> → Backordered · Waiting for Customer · Waiting for Tech/Cus</td><td><span className="ownertag ot-cxr">CXR Team</span></td></tr>
            <tr><td><b>Location</b> → Duct Cleaning – Schedule</td><td><span className="ownertag ot-id">Install Dispatcher</span></td></tr>
            <tr><td><b>☑ Part B/O</b> (part backordered)</td><td><span className="ownertag ot-cxr">CXR Team</span> <span style={{ color: 'var(--muted)', fontSize: 12 }}>(+ Location = Backordered)</span></td></tr>
            <tr><td><b>☑ Cust. Informed of B/O</b></td><td><span className="ownertag ot-pc">Parts Coordinator</span></td></tr>
            <tr><td><b>☑ Parts at Shop</b></td><td><span className="ownertag ot-cxr">CXR Team</span></td></tr>
          </tbody>
        </table>

        <div className="q"><b>To confirm with the team — a few things in the current logic look off:</b>
          <ul>
            <li><b>Service Manager</b> and <b>Rachel</b> are owner options, but nothing auto-routes to them. Intended, or should something hand off to them?</li>
            <li><b>Duct Cleaning – Schedule</b> on the Service board routes to <b>Install Dispatcher</b> — right?</li>
            <li>During a backorder, ownership bounces <b>CXR → Parts Coordinator → CXR</b>. Real hand-off, or should Parts Coordinator own the whole backorder chase?</li>
            <li>New rows land <b>Unassigned</b> even though Location starts at &ldquo;Place Order.&rdquo; Should they auto-route to Parts Coordinator?</li>
          </ul>
        </div>

        <h2 className="sec">Who fills each column</h2>
        <table>
          <tbody>
            <tr><th>Automatic (ServiceTitan / sync)</th><th>Team (manual)</th></tr>
            <tr>
              <td>Date · Job # · Sold By · Customer · Est. Cost · Type · Part/Description · <span className="tag a">Status</span> · <span className="tag a">Owner (auto-routes)</span></td>
              <td>Owner (override) · Supplier · Order # · Cost · Parts Ordered · ETA · Cust. Informed B/O · Location · Parts at Shop · 2 Techs · War? · W.Type · Notes</td>
            </tr>
          </tbody>
        </table>

        <div className="draftnote">
          This is a working draft of how Service <em>should</em> flow. Refine it with the team, then we&apos;ll adjust the board&apos;s routing logic to match. Install gets its own separate workflow tab.
        </div>
      </div>
    </section>
  );
}
