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

### Running locally (Phase 0/1)

The Next.js app currently calls the still-running Express API in `_legacy/api/`
for data. Both processes need to be running:

```bash
# 1. Express API (port 3100)
cd _legacy/api
npm install
npm run dev

# 2. Next.js app (port 3011) — in a second terminal
npm install
npm run dev
```

Login at http://localhost:3011/login.

### Migration phases

- **Phase 0 ✅** — Next.js scaffold, Tailwind, login, dashboard layout, app shell
- **Phase 1 ✅** — Dashboard + Materials list/detail pages reading from Express
- **Phase 2** — Port all Express routes → Next.js Route Handlers; retire `_legacy/api`
- **Phase 3** — Replace custom JWT with NextAuth (house style)
- **Phase 4** — Port remaining pages (trucks, tools, equipment, scanner, etc.)
- **Phase 5** — Replace `node-cron` jobs with Vercel cron + Route Handlers
