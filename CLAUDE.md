---
description:
alwaysApply: true
---

## gstack

Use the /browse skill from gstack for all web browsing, never use mcp__claude-in-chrome__* tools.

Available skills:
- /office-hours
- /plan-ceo-review
- /plan-eng-review
- /plan-design-review
- /design-consultation
- /review
- /ship
- /browse
- /qa
- /qa-only
- /design-review
- /setup-browser-cookies
- /retro
- /debug
- /document-release

# Christmas Air Internal Tools

## REQUIRED: Development Workflow (gstack)

Use gstack skills instead of doing work manually. Skills exist because manual work has caused production incidents.

| Situation | Skill |
|-----------|-------|
| New feature or significant change | `/office-hours` |
| Planning architecture or scope | `/plan-ceo-review` then `/plan-eng-review` |
| UI/UX work planned | `/plan-design-review` |
| Ready to build | `/feature-dev` |
| Something broken | `/investigate` |
| Testing | `/qa` (fix) or `/qa-only` (report) |
| Visual quality check | `/design-review` |
| Code ready to merge | `/review` |
| Shipping a PR | `/ship` |
| After PR merged | `/document-release` |
| Deploying | `/land-and-deploy` |
| After deploying | `/canary` |
| Weekly check-in | `/retro` |
| Security concerns | `/cso` |
| Performance concerns | `/benchmark` |

**Workflows:**
- New feature: `/office-hours` -> `/plan-ceo-review` -> `/plan-eng-review` -> `/plan-design-review` (if UI) -> build -> `/qa` -> `/review` -> `/ship` -> `/land-and-deploy` -> `/canary`
- Bug fix: `/investigate` -> fix -> `/qa` -> `/review` -> `/ship`
- Quick change: make change -> `/review` -> `/ship`

**Rules:**
- NEVER run `git push` or `gh pr create` directly. Use `/ship`.
- NEVER debug by guessing. Use `/investigate`.
- NEVER skip `/review` before merging.
- NEVER deploy without `/canary` for API routes, cron jobs, or auth changes.

## CRITICAL: Timezone Rules

**This company is in TEXAS (Central Time). All dates MUST be in Central Time, not UTC.**

```typescript
// WRONG - toISOString() converts to UTC, causing 6-hour date shifts!
const dateStr = new Date().toISOString().split('T')[0];
// WRONG - Z suffix means UTC!
params.completedOnOrAfter = `${date}T00:00:00Z`;

// CORRECT - Use local date components
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// CORRECT - No Z suffix (ServiceTitan interprets as tenant local time)
params.completedOnOrAfter = `${date}T00:00:00`;
// CORRECT - In daily-dash, use helpers from huddle-utils.ts
import { getTodayDateString, getYesterdayDateString, getLocalDateString } from '@/lib/huddle-utils';
```

## Apps

| App | Directory | URL |
|-----|-----------|-----|
| That's a Wrap | `/debrief-qa` | debrief.christmasair.com |
| Daily Dash | `/daily-dash` | dash.christmasair.com |
| Marketing Hub | `/marketing-hub` | marketing.christmasair.com |
| Internal Portal | `/internal-portal` | portal.christmasair.com |
| AR Collections | `/ar-collections` | ar.christmasair.com |
| Job Tracker | `/job-tracker` | track.christmasair.com |
| AP Payments | `/ap-payments` | ap.christmasair.com |
| Membership Manager | `/membership-manager` | memberships.christmasair.com |
| Doc Dispatch | `/doc-dispatch` | docs.christmasair.com |
| HR Hub | `/hr-hub` | hr.christmasair.com |
| Referrals | `/referrals` | refer.christmasair.com |
| Parts & Equipment | `/parts-equipment` | orders.christmasair.com |

All Next.js apps except debrief-qa (Python/FastAPI). All deployed on Vercel.

### Shared Package (`/packages/shared`)
- `@christmas-air/shared/permissions` - Permission types and utilities
- `@christmas-air/shared/auth` - Auth configuration factory
- `@christmas-air/shared/types` - Shared TypeScript types
- `@christmas-air/shared/components` - Shared UI components (includes `DateRangePicker`)

## Architecture

### SSO
All apps share auth via NextAuth session cookie on `.christmasair.com`. Python app (debrief-qa) validates via Portal's `/api/sso/validate` endpoint.

### Auth & Users
- `portal_users` is the single source of truth for all user accounts
- Roles: Owner (all perms), Manager, Employee
- JSONB `permissions` column for per-app permissions
- Check with `hasPermission(role, permissions, app, permission)`
- Permissions are defined in the shared package; grep for them in code

### ServiceTitan Integration
- No webhook access (except referrals) - uses polling via cron endpoints
- Business Units: HVAC (Install, Service, Commercial/Mims, Maintenance), Plumbing (all combined)
- Revenue Formula: `Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue`
- Saturday = 0.5 business day, Sunday = 0

### Google APIs
- Business Profile API: GBP posts, reviews, performance (Marketing Hub, Daily Dash)
- Google Ads API: LSA leads and performance (Marketing Hub)
- LSA note: Google Ads API query cannot include PII fields without special permissions

### Database (Supabase)
Tables are prefixed by app (e.g., `ap_*`, `mm_*`, `hr_*`, `ref_*`, `tracker_*`). Core tables: `portal_users`, `portal_audit_log`. Check migrations and code for current schema.

## Deployment & Operations

All apps deploy via `vercel --prod` from their directory. Exception: `internal-portal` has a Root Directory conflict; use `vercel redeploy <url>` or the dashboard.

### Cron Jobs
Configured in each app's `vercel.json`. All use UTC (Central = UTC-6, UTC-5 during DST). General pattern:
- Daily full sync at 6am CT (`0 12 * * *`)
- Intraday syncs hourly or every 2 hours during business hours
- Check each app's `vercel.json` for exact schedules

### Secret Scanning
Pre-commit hook + CI runs gitleaks. Run `./scripts/setup-dev.sh` once per machine. Never use `--no-verify`. Config in `.gitleaks.toml`.

### Secret Rotation
Use `./scripts/rotate-secret.sh VAR_NAME [--generate]` to rotate any env var across all 18 apps. NEXTAUTH_SECRET must match across all apps (shared SSO cookie). Use `./scripts/redeploy-all.sh` for parallel deploys.

### GitHub
Private repo: https://github.com/n8dizzle/debrief-tools

## Skill Routing

When the user's request matches a skill, invoke it via the Skill tool. When in doubt, invoke the skill.

- Product ideas, brainstorming -> `/office-hours`
- Strategy, scope -> `/plan-ceo-review`
- Architecture -> `/plan-eng-review`
- Design system, brand -> `/design-consultation`
- Design review of a plan -> `/plan-design-review`
- DX review of a plan -> `/plan-devex-review`
- Full review pipeline -> `/autoplan`
- Bugs, errors, broken -> `/investigate`
- Test the site -> `/qa` or `/qa-only`
- Code review, check diff -> `/review`
- Visual polish -> `/design-review`
- DX audit -> `/devex-review`
- Ship, deploy, create PR -> `/ship`
- Merge + deploy + verify -> `/land-and-deploy`
- Configure deployment -> `/setup-deploy`
- Post-deploy monitoring -> `/canary`
- Update docs after shipping -> `/document-release`
- Weekly retro -> `/retro`
- Security audit -> `/cso`
- Performance benchmarks -> `/benchmark`
- Save/restore progress -> `/context-save`, `/context-restore`
- Safety mode -> `/careful` or `/guard`
- Restrict edits -> `/freeze` or `/unfreeze`
- Code quality -> `/health`
