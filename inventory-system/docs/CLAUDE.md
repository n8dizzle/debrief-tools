# Christmas Air — Inventory System

## What This Project Is

Internal inventory management system for **Christmas Air / Davis Plumbing & AC** (Lewisville, TX). Manages materials, tools, equipment, and fleet across two warehouses and six field trucks, with a ServiceTitan integration for job and technician data.

**Primary users:**
- Warehouse managers — stock control, restock batches, purchase orders
- Field technicians — mobile scanner to consume materials on jobs, tool check-out/in
- Admin (Ray) — full system access, settings, user management

---

## Monorepo Structure

```
inventory-system/
├── api/                        # Express.js + PostgreSQL backend
│   ├── migrations/             # SQL migration files (run in order)
│   │   └── 001_schema.sql      # Full schema — all 22 tables
│   ├── scripts/
│   │   ├── migrate.js          # Migration runner (idempotent)
│   │   └── seed.js             # Dev seed data
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # pg Pool connection
│   │   │   └── env.js          # Validated env vars (crash on missing core vars)
│   │   ├── jobs/               # node-cron scheduled jobs
│   │   │   ├── batchLock.js    # 6 AM daily — locks collecting restock batches
│   │   │   ├── weeklyPO.js     # Monday 7 AM — generates draft POs
│   │   │   ├── stSync.js       # Every 4 hours — ServiceTitan sync
│   │   │   └── index.js        # Scheduler bootstrap
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verify → req.user; requireRole()
│   │   │   ├── validate.js     # Zod schema validation wrapper
│   │   │   └── errorHandler.js # Global error handler + AppError class
│   │   ├── routes/             # One file per resource
│   │   │   ├── index.js        # Mounts all routers at /api/v1/*
│   │   │   ├── auth.js         # /auth/login, /auth/refresh, /auth/me
│   │   │   ├── materials.js    # Materials CRUD + barcode lookup
│   │   │   ├── stock.js        # Movements, warehouse stock, transfer, adjust
│   │   │   ├── trucks.js       # Fleet + truck stock
│   │   │   ├── warehouses.js   # Warehouse stock views
│   │   │   ├── restockBatches.js  # Restock workflow
│   │   │   ├── purchaseOrders.js  # PO lifecycle
│   │   │   ├── tools.js        # Tool check-out/in
│   │   │   ├── equipment.js    # Equipment + warranty tracking
│   │   │   ├── itAssets.js     # IT asset management
│   │   │   ├── techBins.js     # Scanner staging bins
│   │   │   ├── jobs.js         # ST job cache for scanner
│   │   │   ├── vendors.js      # Alias for /supply-houses (frontend compat)
│   │   │   ├── notifications.js   # DB-derived alerts (no notifications table)
│   │   │   ├── settings.js     # app_settings key/value store
│   │   │   ├── users.js        # User management (admin)
│   │   │   ├── supplyHouses.js # Vendor management
│   │   │   ├── servicetitan.js # Manual ST sync triggers
│   │   │   └── admin.js        # Ops: batch lock, PO run, ST jobs sync, stats
│   │   ├── services/
│   │   │   ├── authService.js      # bcrypt + JWT login/refresh
│   │   │   ├── materialService.js  # Stock ledger writes (recordMovement, adjustStock)
│   │   │   ├── stService.js        # ServiceTitan API calls (syncPricebook, syncJobs, etc.)
│   │   │   ├── poService.js        # PO creation and line management
│   │   │   ├── restockService.js   # Restock batch state machine
│   │   │   ├── toolService.js      # Tool checkout/return logic
│   │   │   ├── binService.js       # Tech bin scan reconciliation
│   │   │   └── itAssetService.js   # IT asset assignment history
│   │   └── app.js              # Express app (no listen here)
│   ├── server.js               # Entry point — DB check, scheduler, listen
│   └── package.json            # Node 18+, port 3100
│
├── frontend/                   # React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # Axios instance, /api base URL, JWT interceptor + auto-refresh
│   │   ├── context/
│   │   │   └── AuthContext.jsx # User state, login(), logout(), loading flag
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Materials.jsx / MaterialDetail.jsx
│   │   │   ├── Tools.jsx / ToolDetail.jsx
│   │   │   ├── Equipment.jsx / EquipmentDetail.jsx
│   │   │   ├── ITAssets.jsx / ITAssetDetail.jsx
│   │   │   ├── Trucks.jsx / TruckDetail.jsx
│   │   │   ├── Warehouses.jsx / WarehouseDetail.jsx
│   │   │   ├── RestockQueue.jsx / RestockBatchDetail.jsx
│   │   │   ├── PurchaseOrders.jsx / PurchaseOrderDetail.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── scanner/        # Mobile-first scanner UI (dark theme)
│   │   │       ├── ScannerHome.jsx
│   │   │       ├── ConsumeMaterial.jsx
│   │   │       ├── ToolAction.jsx
│   │   │       ├── TruckLookup.jsx
│   │   │       ├── ReplenishBin.jsx
│   │   │       ├── ReceivePO.jsx
│   │   │       └── TransferStock.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx / Sidebar.jsx   # App shell
│   │   │   ├── TransferModal.jsx          # Move stock warehouse ↔ truck
│   │   │   ├── CreatePOModal.jsx          # PO creation wizard
│   │   │   └── scanner/
│   │   │       └── JobPicker.jsx          # Bottom-sheet job selector
│   │   └── App.jsx             # Routes + RequireAuth guard
│   └── vite.config.js          # Proxy: /api → API server (with /api/v1 rewrite)
│
└── mock-api/
    └── server.js               # In-memory mock (port 3456) for UI dev without DB
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS, Vite |
| Backend | Node.js 18+, Express 4, Zod (validation), node-cron |
| Database | PostgreSQL 15 via Supabase |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Email | SendGrid (optional — alerts only) |
| ST Integration | ServiceTitan REST API (optional — graceful degradation) |
| HTTP Client | Axios |

> **⚠️ Company standards note:** Insert your company's required stack constraints here (TypeScript requirements, ESLint config, test framework, etc.). See `STANDARDS.md` (to be created from your internal spec).

---

## Database Schema (22 tables)

Core tables and their purpose:

```
warehouses            — Lewisville (plumbing) + Argyle (HVAC)
warehouse_locations   — Bin/shelf locations within a warehouse
trucks                — P-01..P-03 (plumbing), H-01..H-03 (HVAC)
users                 — Staff + technicians; roles: admin/manager/tech/viewer
supply_houses         — Vendors (Ferguson, Johnstone, Carrier, etc.)
materials             — Parts catalog with SKU, barcode, reorder points
warehouse_stock       — qty_on_hand per material per warehouse (+ location)
truck_stock           — qty_on_hand per material per truck
material_movements    — Immutable ledger of all stock changes
restock_batches       — Truck restocking workflow (collecting→locked→approved→completed)
restock_lines         — Line items within a restock batch
purchase_orders       — POs to supply houses
po_lines              — PO line items
tech_bins             — Scanner staging bins for scanned items
bin_items             — Items within a tech bin
tools                 — Individual tool inventory with check-out state
tool_movements        — Tool check-out/return history
equipment             — Major equipment (A/C units, etc.) + warranty dates
it_assets             — Company devices (laptops, tablets, phones)
it_asset_assignments  — Who had which device and when
st_jobs               — ServiceTitan job cache for scanner job-picker
app_settings          — Key/value config store (company info, thresholds, etc.)
scheduled_job_log     — Cron job execution history
st_sync_log           — ServiceTitan sync history
schema_migrations     — Applied migration tracking
```

---

## API Endpoints Reference

All routes are prefixed `/api/v1/`. Auth required on all except `/auth/login` and `/auth/refresh`.

```
POST   /auth/login                    — { email, password } → { access_token, refresh_token, user }
POST   /auth/refresh                  — { refresh_token } → { access_token }
GET    /auth/me                       — current user

GET    /materials                     — list (filterable by category, dept, search, barcode)
GET    /materials/:id                 — detail + warehouse_stock + truck_stock
POST   /materials                     — create [admin/manager]
PATCH  /materials/:id                 — update [admin/manager]

GET    /stock/movements               — movement history (filterable)
POST   /stock/movements               — record a movement
POST   /stock/transfer                — move stock warehouse ↔ truck
POST   /stock/adjust                  — manual qty adjustment [admin/manager]
POST   /stock/cycle-count             — submit physical count
GET    /stock/warehouse/:id           — all stock at a warehouse

GET    /trucks                        — list active trucks
GET    /trucks/:id                    — detail + stock
GET    /warehouses
GET    /warehouses/:id                — detail + stock

GET    /restock-batches               — list batches
POST   /restock-batches               — create batch
GET    /restock-batches/:id
POST   /restock-batches/:id/lock      — lock for manager review
POST   /restock-batches/:id/approve   — approve → ready to pick
POST   /restock-batches/:id/complete  — mark completed

GET    /purchase-orders
POST   /purchase-orders               — create PO
GET    /purchase-orders/:id
PATCH  /purchase-orders/:id/status

GET    /tools
GET    /tools/:id
POST   /tools/:id/checkout
POST   /tools/:id/return

GET    /equipment
GET    /equipment/:id

GET    /it-assets
GET    /it-assets/:id

GET    /tech-bins
GET    /tech-bins/:id
POST   /tech-bins                     — open a bin
POST   /tech-bins/:id/scan            — scan item into bin
POST   /tech-bins/:id/close           — reconcile + record movements

GET    /jobs                          — ST job cache (truck_id, status filters)
GET    /vendors                       — supply houses alias (frontend compat)
GET    /notifications                 — computed alerts from DB state
POST   /notifications/:id/read
POST   /notifications/read-all
GET    /settings
PATCH  /settings                      — [admin/manager]
POST   /settings/st-sync-now          — trigger immediate ST sync

GET    /users                         — [admin]
POST   /users                         — create user [admin]
PATCH  /users/:id

GET    /admin/stats/dashboard
POST   /admin/jobs/batch-lock
POST   /admin/jobs/po-run
POST   /admin/jobs/st-sync
GET    /admin/jobs/log
```

---

## Environment Variables

### API (`api/.env`)
```
# Required — app will not start without these
DATABASE_URL=            # Supabase connection string (pooler URL)
JWT_SECRET=              # Min 32 chars, random
JWT_REFRESH_SECRET=      # Different from JWT_SECRET

# Optional — warn on startup if missing, features gracefully disabled
ST_CLIENT_ID=
ST_CLIENT_SECRET=
ST_TENANT_ID=
ST_APP_KEY=
SENDGRID_API_KEY=
FROM_EMAIL=

# Defaults shown
PORT=3100
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
# Only needed if not using Vite dev proxy (e.g. production deploy)
VITE_API_BASE_URL=https://your-api-domain.com/api
```

---

## Development Workflow

### Prerequisites
- Node.js 18+
- A Supabase project (see `SUPABASE_SETUP.md`)

### First-time setup
```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/inventory-system.git
cd inventory-system

# 2. Install dependencies
cd api && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configure API environment
cp api/.env.example api/.env
# Edit api/.env — fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 4. Run database migrations
cd api && node scripts/migrate.js

# 5. Seed development data (creates test users + sample inventory)
node scripts/seed.js

# 6. Start API (port 3100)
npm run dev

# 7. In a new terminal — start frontend (port 5173)
cd ../frontend && npm run dev
```

### Dev login credentials (after seed)
| Email | Password | Role |
|---|---|---|
| admin@christmasair.com | admin123 | admin |
| mgr@christmasair.com | pass123 | manager |
| carlos@christmasair.com | pass123 | tech (Truck P-01) |
| sam@christmasair.com | pass123 | tech (Truck H-01) |

### Switching between mock and real API
In `frontend/vite.config.js`, toggle `USE_REAL_API`:
- `false` → mock API on port 3456 (`cd mock-api && node server.js`)
- `true` → real API on port 3100 (requires DB)

**Always restart the Vite dev server after changing `vite.config.js`.**

---

## Key Patterns & Conventions

### Auth flow
- Login returns `access_token` (15m) + `refresh_token` (7d)
- `client.js` attaches Bearer token to every request
- On 401, `client.js` auto-refreshes using the refresh token
- `requireAuth` middleware populates `req.user` from JWT + DB lookup
- `requireRole('admin', 'manager')` enforces RBAC — valid roles: `admin`, `manager`, `tech`, `viewer`

### Stock mutations
All stock changes go through `materialService.recordMovement()`. This writes to `material_movements` (immutable ledger) and upserts `warehouse_stock` or `truck_stock`. Never write directly to the stock tables.

### Notifications
There is no `notifications` table. `GET /notifications` computes alerts on-demand from: low warehouse_stock, locked restock_batches, overdue tools, pending_review purchase_orders.

### Settings
App-level config lives in `app_settings` (section + key + value). Defaults are in `routes/settings.js::DEFAULTS`. New settings should be added there and in the DEFAULTS object together.

### Scheduled jobs
Cron expressions are configurable via env vars (`BATCH_LOCK_CRON`, `WEEKLY_PO_CRON`, `ST_SYNC_CRON`, `BIN_ALERT_CRON`). All jobs log to `scheduled_job_log`.

### Error handling
Throw `new AppError(message, statusCode)` for known errors. The global error handler in `middleware/errorHandler.js` formats Zod validation errors, JWT errors, Postgres constraint errors, and AppErrors consistently.

### Frontend API calls
All calls go through `src/api/client.js` (Axios). The base URL is `/api` (proxied by Vite in dev). Use `?? []` / `?? {}` fallbacks when reading response data — e.g. `data.materials ?? []` — because some endpoints return null instead of empty arrays when the table is empty.

---

## ServiceTitan Integration

ST credentials are optional. When `ST_CLIENT_ID` is missing or `'placeholder'`:
- The API starts normally with a console warning
- `POST /settings/st-sync-now` returns a friendly "not configured" message
- `POST /admin/jobs/st-sync` skips gracefully

When configured, ST syncs run every 4 hours and populate: materials (from pricebook), equipment, users (technicians), trucks (vehicles), and `st_jobs`.

---

## Known Issues / Gotchas

1. **Vite config requires restart** — changing `vite.config.js` proxy settings does not hot-reload. Kill and restart `npm run dev` in the frontend.

2. **mock-api vs real API** — the mock API returns users with a `name` field; the real API returns `first_name`/`last_name`. Components handle both via `user.name ?? \`${user.first_name} ${user.last_name}\``.

3. **`stService.syncJobs()`** — the ST jobs sync is wired up but the exact ST API endpoint path for jobs may need to be confirmed against your ST tenant's API docs.

4. **Supabase pooler URL** — use the **pooler** connection string (port 5432, not 6543) for the API. The direct connection string can hit connection limits under load.

5. **Password hashing** — `password_hash` in the `users` table is nullable. Users created via the ST sync won't have passwords set; use `POST /users` or `authService.createUser()` to set passwords.

6. **`NULLS NOT DISTINCT`** — the `warehouse_stock` unique constraint uses `UNIQUE NULLS NOT DISTINCT`, a Postgres 15+ feature. Supabase supports this on all current plans.

---

## Pending Work / Roadmap

- [ ] TypeScript migration (per company standards — add to STANDARDS.md)
- [ ] Test suite (unit tests for services, integration tests for routes)
- [ ] Production deployment (Supabase prod, Railway/Render for API, Netlify/Vercel for frontend)
- [ ] ServiceTitan jobs sync endpoint path verification
- [ ] `auth/me` should return `assigned_truck` object for scanner pages (currently scanner reads `me.truck`)
- [ ] Push notifications for low-stock alerts (currently email-only via SendGrid)
- [ ] Equipment warranty expiry notifications
- [ ] Cycle count scheduling UI
