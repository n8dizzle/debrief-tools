# CLAUDE.MD — Sales Command Center

> **Live:** https://sales.christmasair.com · **Vercel project:** `sales-command-center`
> **Internal name:** "Sales Command Center" (package name is `christmas-air-dashboard`)

## Project Overview

Lead tracking + manual assignment dashboard for Christmas Air's sales team. Staff
enter/review leads, assign them to comfort advisors (with a round-robin "next in line"
suggestion), and track each lead through the pipeline. Sales metrics are pulled from
ServiceTitan on demand.

> **History (Jun 2026):** the automated side was removed — the every-2-min ServiceTitan
> poll, round-robin auto-assignment, client-side auto-poller, and all Slack advisor DMs.
> This is now a **manual-only** app. If you're looking for the old `/api/leads/poll`,
> `/api/cron/sync`, `lib/slack.ts`, or `/api/slack/*`, they were deleted on purpose.

**Tech Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand (client UI
state), Recharts, Supabase (persistence), NextAuth (Google OAuth), ServiceTitan API
(sales-metric + lead sync, on-demand). `@dnd-kit` for drag-and-drop queue ordering.

## Auth (SSO — shared with all christmasair.com apps)

- NextAuth Google OAuth (`lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`).
- Sign-in gated to `@christmasair.com` (override via `ALLOWED_EMAIL_DOMAINS`).
- Users validated against the shared **`portal_users`** table — unregistered →
  `/login?error=NotRegistered`, inactive → `/login?error=AccountInactive`.
- In production the session cookie is scoped to `.christmasair.com`, so login is shared
  across all the sibling apps (same SSO pattern as the rest of the monorepo).
- `middleware.ts` protects everything except `login`, `api/auth`, and static assets.
  (No more public secret-gated endpoints — they were removed with the automation.)

## Persistence (Supabase)

All state lives in Supabase. Zustand is used only for transient client-side UI state.

Schema files:
- `supabase-schema.sql` — `comfort_advisors`, `leads`, `service_titan_config`
- `supabase-migration-lead-automation.sql` — `lead_assignment_log`, `cron_lock`
  (legacy: these backed the old auto-assignment; harmless to leave, no longer written by a cron)

Key tables:
- **`leads`** — see `DbLead` in `lib/supabase.ts`. Tracks `lead_type` (`TGL` | `Marketed`),
  `status`, `assigned_advisor_id`, ST ids, margin fields, timestamps.
- **`comfort_advisors`** — roster + queue state: `in_queue`, `tgl_queue_position`,
  `marketed_queue_position`, plus rollup stats (sales_mtd, closing_rate, etc.).
- **`service_titan_config`** — optional DB-stored ST creds (env vars take precedence).

Supabase clients live in `lib/supabase.ts`: `supabase` (client, anon, null-safe) and
`createServerSupabaseClient()` / `getServerSupabase()` (server, service-role).

## Lead Flow (manual)

```
Staff enters/reviews a lead ──► assigns to an advisor (round-robin suggests next)
                            ──► advances status through the pipeline
```

- **Lead types**: `Marketed` and `TGL` (Tech Generated Lead).
- **Round-robin** is a *suggestion* — `getNextMarketedAdvisor()` / queue positions on
  `comfort_advisors` show who's next; assignment itself is a deliberate user action.
- **Manual assignment** endpoint: `app/api/leads/[id]/assign`. Marketed lead entry uses
  the `addAndAssignLead` store action (`components/views/MarketedLeadEntryView.tsx`).
- **Status pipeline**: New Lead → Assigned → Quoted → Sold → Install Scheduled → Completed.

## ServiceTitan (on-demand, `lib/serviceTitan.ts` + `app/api/servicetitan`)

The `/api/servicetitan` route is action-based (POST `{ action }`). Live actions include:
`test`, `sync` (import leads), `syncSales` (refresh advisor sales metrics),
`syncAdvisors` / `syncTechnicians`, `linkAdvisors`, `create`, plus diagnostic helpers
(`getUnassignedJobs`, `getJobTypes`, `getForms`, etc.). These run when a user triggers
them in the UI — there is no scheduled sync.

- Marketed leads: ST Business Unit `33643795`, Job Type `52687000`.
- TGL: Job Type `52683039` / the `TGL Form`.

## API Routes (`app/api/`)

| Route | Purpose |
|---|---|
| `auth/[...nextauth]` | NextAuth Google OAuth |
| `leads` | Leads list/CRUD |
| `leads/[id]` | Single lead read/update |
| `leads/[id]/assign` | Manual assignment |
| `leads/[id]/estimates` | ST estimates for a lead |
| `leads/mark-assigned` | Mark lead assigned |
| `advisors` | Comfort advisor roster CRUD |
| `servicetitan` | On-demand ST sync/config (action-based) |
| `migrate` | One-off schema/data migration helper |

## Environment Variables

See `.env.example`. Required groups:
- **ServiceTitan**: `ST_CLIENT_ID`, `ST_CLIENT_SECRET`, `ST_TENANT_ID`, `ST_APP_KEY`,
  `ST_ENVIRONMENT`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- **Auth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
  `ALLOWED_EMAIL_DOMAINS` (optional)
- **Misc**: `SERVICE_TITAN_WEB_URL` (job deep-links), `NEXT_PUBLIC_DASHBOARD_URL`

> Obsolete after the automation removal (safe to delete from Vercel): `CRON_SECRET`,
> `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_WEBHOOK_URL`, `SLACK_TGL_WEBHOOK_URL`,
> `TEST_MODE`, `TEST_DM_EMAILS`, `ADMIN_EMAIL`, `TGL_AFTER_SUBMISSION_ID`. Note
> `NEXT_PUBLIC_DASHBOARD_URL` had a trailing newline in its stored value — re-add it
> clean if you ever wire it back into anything.

## Timezone Rule (company-wide)

Christmas Air is in **Central Time**. NEVER use `toISOString().split('T')[0]` (converts to
UTC, causes date shifts). Use local date components, and send ServiceTitan timestamps
WITHOUT a `Z` suffix (ST interprets them as tenant-local). See the root `CLAUDE.md`.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Deployment

Vercel project `sales-command-center` (org `n8dizzles-projects`). Deploys via Vercel's
GitHub integration. `sales.christmasair.com` is wired into the internal portal's tools
launcher (`internal-portal/app/api/tools/route.ts`). No cron jobs (`vercel.json` is `{}`).

## Notes for AI Assistants

1. **Manual-only app.** No scheduled jobs, no auto-assignment, no Slack DMs. Don't
   re-introduce them without an explicit ask.
2. **Persistence is Supabase**, not in-memory.
3. **Auth is live SSO** against `portal_users`, shared cookie on `.christmasair.com`.
4. **Round-robin is a suggestion**, not an automatic assigner (`comfort_advisors`
   `*_queue_position` / `in_queue`).
5. **ServiceTitan runs on demand** via `/api/servicetitan` actions, triggered from the UI.

## Contact & Context

- **Company**: Christmas Air Conditioning & Plumbing
- **Purpose**: Manual sales lead intake, assignment, and pipeline tracking
- **Users**: Comfort advisors + sales managers
