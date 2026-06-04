# Christmas Air — Parts Dashboard
## Cursor / Developer Integration Guide

---

## Project Overview

This is a parts and equipment order tracking dashboard for Christmas Air HVAC, built to replace a Google Sheets-based workflow. The frontend prototype is complete and fully functional. Your job is to:

1. Integrate it into `portal.christmasair.com`
2. Replace the sample data array with live ServiceTitan API data
3. Persist order state (owner, location, notes, etc.) to a database
4. Wire up real user authentication so "Completed by" captures the logged-in user

---

## Files

- `parts-dashboard.html` — Complete standalone prototype. All UI, logic, and styles in one file.
- `parts-order-hub.html` — Employee SOP reference hub (static, no backend needed)

---

## Tech Stack Assumptions

- **Frontend**: The dashboard is plain HTML/CSS/JS — no framework. Port to React/Next.js if your portal uses it, or serve as-is in an iframe/route.
- **Backend**: Node.js / Next.js API routes recommended (matches portal stack)
- **Database**: Postgres or Supabase recommended (see schema below)
- **Auth**: Use existing portal session for current user name

---

## ServiceTitan API Integration

### Credentials needed
| Item | Where to find |
|------|--------------|
| `CLIENT_ID` | ST Settings → Integrations → API Application |
| `CLIENT_SECRET` | ST Settings → Integrations → API Application |
| `TENANT_ID` | ST URL: `app.servicetitan.com/tenant/XXXXXXX` |

**Never expose these in frontend code. All ST calls go through your backend.**

### Authentication
```js
// POST https://auth.servicetitan.io/connect/token
const res = await fetch('https://auth.servicetitan.io/connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.ST_CLIENT_ID,
    client_secret: process.env.ST_CLIENT_SECRET,
  })
});
const { access_token } = await res.json();
// Token expires in 1800s — cache and refresh automatically
```

### Key API endpoints (all relative to `https://api.servicetitan.io`)

```
# Get all jobs tagged "Parts Requested"
GET /jpm/v2/tenant/{tenantId}/jobs
  ?tagTypeIds={partsRequestedTagId}
  &status=Scheduled,Unscheduled
  &pageSize=200

# Get single job
GET /jpm/v2/tenant/{tenantId}/jobs/{jobId}

# Get estimates for a job
GET /sales/v2/tenant/{tenantId}/estimates?jobId={jobId}

# Get all tag types (run once to find your tag IDs)
GET /settings/v2/tenant/{tenantId}/tag-types

# Add tag to job ("Parts In")
POST /jpm/v2/tenant/{tenantId}/jobs/{jobId}/tags
Body: { "tagTypeId": {partsInTagId} }

# Remove tag from job
DELETE /jpm/v2/tenant/{tenantId}/jobs/{jobId}/tags/{tagId}

# Get technicians
GET /settings/v2/tenant/{tenantId}/technicians?active=true
```

### Tag IDs to locate in your account
| Tag | Purpose |
|-----|---------|
| `Parts Requested` | Auto-added by ST form when tech selects "perform later" |
| `Parts In` | Added by warehouse when part arrives |

---

## Database Schema

ServiceTitan stores job/customer/tech data. Your DB stores the supplemental fields the dashboard adds.

```sql
CREATE TABLE parts_orders (
  -- Identity
  job_id            VARCHAR(20) PRIMARY KEY,   -- ST job number, also used as PO#
  st_url            TEXT,                       -- direct link to ST job

  -- Populated from ST API
  customer_name     VARCHAR(255),
  technician        VARCHAR(100),
  job_type          VARCHAR(50),               -- Parts, Equipment, W/Parts, etc.
  date_added        DATE,

  -- Dashboard-managed fields
  owner             VARCHAR(50),               -- CXR, Warehouse, Service Manager, Install Manager, Sales, Rachel
  location          VARCHAR(50),               -- Place Order, Shipping to Shop, Lewisville Shop, etc.
  supplier          VARCHAR(100),
  order_number      VARCHAR(100),
  part_description  TEXT,
  part_cost         VARCHAR(20),
  is_equipment      BOOLEAN DEFAULT false,
  warranty          VARCHAR(10),               -- No, P, P/L, E/L, E
  eta_date          DATE,
  scheduled_date    DATE,

  -- Notes
  notes_warehouse   TEXT,
  notes_cxr         TEXT,

  -- Backorder flow
  bo_notified       BOOLEAN DEFAULT false,
  bo_notified_date  DATE,

  -- Cancel flow
  cancel_source     VARCHAR(255),
  cancel_reason     TEXT,

  -- Completion
  status            VARCHAR(20) DEFAULT 'open', -- open, completed, cancelled
  completed_by      VARCHAR(100),
  completed_at      TIMESTAMPTZ,

  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table
CREATE TABLE parts_audit_log (
  id          SERIAL PRIMARY KEY,
  job_id      VARCHAR(20),
  event_type  VARCHAR(50),   -- owner, location, completed, cancelled, edit
  action      TEXT,
  detail      TEXT,
  performed_by VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Backend API Routes

Create these routes in your portal backend. The frontend calls these — never ST directly.

```
GET    /api/parts-orders              → fetch all open orders (merge ST data + DB)
GET    /api/parts-orders/:jobId       → single order detail
POST   /api/parts-orders              → create new order row
PATCH  /api/parts-orders/:jobId       → update owner, location, notes, etc.
POST   /api/parts-orders/:jobId/complete   → mark completed, log who did it
POST   /api/parts-orders/:jobId/cancel     → cancel PO, log reason
GET    /api/parts-orders/audit        → fetch audit log
GET    /api/technicians               → proxy ST technicians list
```

### Example PATCH handler
```js
// PATCH /api/parts-orders/:jobId
export async function PATCH(req, { params }) {
  const { jobId } = params;
  const body = await req.json();
  const user = getCurrentUser(req); // from portal session

  const updated = await db.parts_orders.update({
    where: { job_id: jobId },
    data: {
      ...body,
      updated_at: new Date()
    }
  });

  // Log to audit table
  await db.parts_audit_log.create({
    data: {
      job_id: jobId,
      event_type: 'edit',
      action: `Updated by ${user.name}`,
      detail: JSON.stringify(body),
      performed_by: user.name
    }
  });

  return Response.json(updated);
}
```

---

## Replacing Sample Data in the Frontend

In `parts-dashboard.html`, find:
```js
const SAMPLE = [ ... ];
let orders = SAMPLE.map(o => ({...o}));
```

Replace with:
```js
let orders = [];

async function loadOrders() {
  try {
    const res = await fetch('/api/parts-orders');
    orders = await res.json();
    checkAutoComplete();
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

// Auto-refresh every 60 seconds
loadOrders();
setInterval(loadOrders, 60000);
```

### Wire save/update calls
Find `function saveChanges()` and add an API call:
```js
// After o.* assignments, before closeModal:
await fetch(`/api/parts-orders/${o.job}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    owner: o.owner,
    location: o.location,
    supplier: o.supplier,
    order_number: o.orderNum,
    part_cost: o.cost,
    part_description: o.part,
    is_equipment: o.isEquipment,
    eta_date: o.eta,
    notes_warehouse: o.noteWh,
    notes_cxr: o.noteCxr,
    cancel_source: o.cancelSource
  })
});
```

### Wire add order call
Find `function addOrder()` and add:
```js
await fetch('/api/parts-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newOrder)
});
```

---

## Auto Owner Logic (already in frontend)

The `ownerForLocation(loc, isEquipment)` function in the dashboard handles all automatic owner assignment. Do not replicate this on the backend — let the frontend calculate it and send the resolved owner in the PATCH body.

| Location | Equipment? | Auto Owner |
|----------|-----------|------------|
| Place Order | either | Warehouse |
| Shipping to Shop | either | Warehouse |
| P/U Supply House | either | Warehouse |
| Shipping to Supplier | either | Warehouse |
| Lewisville Shop | No | CXR |
| Lewisville Shop | Yes | Install Manager |
| Backordered | either | CXR |
| Waiting for Tech/Cus | either | Service Manager |
| Duct Cleaning - Schedule | either | Rachel |

---

## Row Color Rules (frontend only, no backend needed)

| Condition | Color |
|-----------|-------|
| Location = Backordered | Bright yellow |
| Location = Cancel PO | Bright orange |
| Scheduled date set | Bright green |
| Owner = Warehouse | Blue |
| Owner = CXR | Green |
| Owner = Rachel | Teal |
| Age > 30 days | Red left border |

---

## "Completed By" — Capturing Logged-In User

In `closeOutOrder()`, replace the manual input with the portal session user:

```js
// Replace:
const completedByName = document.getElementById('completed-by').value.trim() || 'Unknown';

// With (adjust to your auth pattern):
const completedByName = window.__currentUser?.name || 
                        document.getElementById('completed-by').value.trim() || 
                        'Unknown';
```

Set `window.__currentUser` in your portal layout:
```html
<script>
  window.__currentUser = {
    name: "{{ session.user.name }}",
    email: "{{ session.user.email }}"
  };
</script>
```

---

## Business Rules to Enforce

- **30-day aging rule**: Flag any open order where `date_added < NOW() - INTERVAL '30 days'` and `notes_cxr` is empty
- **Cancel PO flow**: Two steps required — CXR selects reason (cancels ST estimate), Warehouse confirms vendor PO cancelled. Only then archive.
- **Backorder flow**: Location → Backordered sets owner to CXR. CXR checks notification checkbox → owner returns to Warehouse.
- **No estimate should stay in ST Follow Up**: When Cancel PO is initiated, the ST estimate must be dismissed via `PATCH /sales/v2/tenant/{tenantId}/estimates/{estimateId}` with `{ "status": "Dismissed" }`

---

## Environment Variables needed

```env
ST_CLIENT_ID=your_client_id
ST_CLIENT_SECRET=your_client_secret
ST_TENANT_ID=your_tenant_id
DATABASE_URL=your_postgres_connection_string
```

---

## Docs & References

- ST API reference: https://developer.servicetitan.io/docs/apis
- ST Auth guide: https://developer.servicetitan.io/docs/authentication
- ST Estimates API: https://developer.servicetitan.io/api-details#api=dynamic-v2-prod-apis&operation=Estimates_GetList
