# Christmas Air — Inventory System

Internal inventory management for Davis Plumbing & AC / Christmas Air.

Covers two warehouses (Lewisville + Argyle), six field trucks, ServiceTitan integration, and a mobile scanner for technicians.

---

## Quick Start (New Developer)

**Prerequisites:** Node.js 18+, access to the Supabase project credentials (ask Ray)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/inventory-system.git
cd inventory-system

# 2. Install dependencies
cd api && npm install
cd ../frontend && npm install

# 3. Set up API environment
cp api/.env.example api/.env
# Fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET (get from Ray or team password manager)

# 4. Run migrations (first time only)
cd api && node scripts/migrate.js

# 5. Seed dev data (first time only — skip for production)
node scripts/seed.js

# 6. Start both servers (in separate terminals)
cd api && npm run dev          # API → http://localhost:3100
cd frontend && npm run dev     # UI  → http://localhost:5173
```

**Dev logins:**
- `admin@christmasair.com` / `admin123`
- `carlos@christmasair.com` / `pass123` (technician)

---

## Project Structure

```
api/        Express + PostgreSQL backend  (port 3100)
frontend/   React + Vite + Tailwind UI    (port 5173)
mock-api/   In-memory mock for UI-only dev (port 3456)
```

Full architecture documentation: see **CLAUDE.md**

---

## Key Docs

| Document | Purpose |
|---|---|
| `CLAUDE.md` | Full project context for Claude Code — architecture, patterns, gotchas |
| `SUPABASE_SETUP.md` | How to provision and migrate the Supabase database |
| `api/.env.example` | All API environment variables with descriptions |
| `frontend/.env.example` | Frontend environment variables |

---

## Development Notes

- Switching between mock API and real API: edit `USE_REAL_API` in `frontend/vite.config.js` then **restart the Vite dev server**
- All stock mutations go through `materialService.recordMovement()` — never write directly to `warehouse_stock` or `truck_stock`
- New routes must be registered in `api/src/routes/index.js`
- Valid user roles: `admin`, `manager`, `tech`, `viewer`

---

## Team

| Name | Role | Access |
|---|---|---|
| Ray Davis | Owner / Admin | Full access |
| — | — | — |

*Update this table as team members are added.*

---

## Contributing

See `STANDARDS.md` for code style, branch naming, PR process, and company tool requirements.
