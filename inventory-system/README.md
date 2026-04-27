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
- **Phase 4** — Port remaining pages (trucks, tools, equipment, scanner, etc.)
- **Phase 5** — Replace `node-cron` jobs with Vercel cron + Route Handlers
  (`/api/admin/jobs/batch-lock`, `/api/admin/jobs/po-run`, `/api/st/sync/*`
  are already Route Handlers — just need cron entries in `vercel.json`).
