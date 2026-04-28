# inventory-system

Internal inventory management for Christmas Air / Davis Plumbing —
materials, tools, equipment, and fleet across two warehouses and six trucks,
with ServiceTitan integration.

## Layout (mid-migration)

This app is being migrated from a Vite+Express prototype into a Next.js +
TypeScript app to match the rest of `debrief-tools`.

```
inventory-system/
├── app/              # Next.js App Router (the new app)
├── components/
├── lib/              # api client, session helpers
├── types/            # shared TS types
├── docs/             # setup guides
└── _legacy/          # Express API + Vite dashboard (kept for Phase 2 reference)
    ├── api/          # to be ported to app/api/.../route.ts
    └── dashboard/    # to be ported to app/(staff)/.../page.tsx
```

### Running locally

The Next.js app talks to Postgres (Supabase) directly. No Express needed.

```bash
cp .env.example .env.local   # then fill in DATABASE_URL + JWT secrets
npm install
npm run dev
```

Login at http://localhost:3011/login.

### Migration phases

- **Phase 0 ✅** — Next.js scaffold, Tailwind, login, dashboard layout, app shell
- **Phase 1 ✅** — Dashboard + Materials list/detail pages
- **Phase 2 ✅** — All Express routes ported to Next.js Route Handlers; legacy
  `_legacy/api/` removed. The Next.js app talks to Postgres directly through
  `lib/services/*` shared by both server pages and route handlers.
- **Phase 3 ✅** — Custom JWT replaced with NextAuth. Two providers: Google
  (production, restricted to `christmasair.com`) and Credentials (dev fallback
  using existing email+password). Sessions enriched from local `users` table
  in the `jwt`/`session` callbacks. `getAuthedUser(req)` signature preserved
  so route handlers didn't need touching.
- **Phase 4 ✅** — Office portal pages built: list + detail for Trucks,
  Warehouses, Tools, Equipment, IT Assets, Vendors, Purchase Orders, Restock
  Batches, Users; plus an admin Settings page with sectioned forms and an
  inline ServiceTitan "Sync now" button.
- **Phase 4b ✅** — Mobile scanner under `/scan/*` with its own mobile-first
  layout. Workflows: Consume material on job, Tool check-out/in, Stock
  transfer, Bin scan. Reusable `BarcodeInput` autofocuses on mount and
  works with USB/Bluetooth scanners and manual typing. Office-side write
  actions also wired: tool checkout/checkin/send-for-service, restock batch
  lock/approve/pick/complete, PO send + receive form. `app/page.tsx`
  redirects technicians to `/scan` and everyone else to `/dashboard`.
- **Phase 5 ✅** — Vercel Cron wired up.
  - `vercel.json` schedules three cron jobs (UTC times):
    - `0 11 * * *`  → `/api/cron/batch-lock` (≈6 AM Central)
    - `0 12 * * 1`  → `/api/cron/weekly-po`  (Mon ≈7 AM Central)
    - `0 */4 * * *` → `/api/cron/st-sync`    (every 4h; pricebook +
                                              equipment + technicians)
  - Each cron handler verifies `Authorization: Bearer ${CRON_SECRET}`
    via `lib/cron-guard.ts`. Vercel sets that header automatically.
  - The same business logic lives in `lib/services/admin-jobs.ts` and
    `lib/services/st.ts` — admin-triggered (`/api/admin/jobs/*`) and
    cron-triggered (`/api/cron/*`) endpoints share it.
  - Settings page lists the schedules and most recent run of each job
    from `scheduled_job_log`.

  **Deployment notes**
  - Set `CRON_SECRET` in the Vercel project env (any random string).
  - Vercel Hobby plan caps at 2 daily-only cron jobs; upgrade to Pro
    to use the 4-hour ST sync, or comment that entry out and trigger
    ST manually from the Settings page.
