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
- **Phase 2 ✅ (partial)** — Auth + Materials + Trucks + Warehouses + Dashboard stats
  ported to Next.js Route Handlers and shared services. App runs without Express.
- **Phase 2 cont.** — Port remaining routes: stock, restock-batches, purchase-orders,
  tools, equipment, it-assets, tech-bins, jobs, vendors, notifications, settings,
  users, admin (ST sync triggers, cron triggers).
- **Phase 3** — Replace custom JWT with NextAuth (house style)
- **Phase 4** — Port remaining pages (trucks, tools, equipment, scanner, etc.)
- **Phase 5** — Replace `node-cron` jobs with Vercel cron + Route Handlers
