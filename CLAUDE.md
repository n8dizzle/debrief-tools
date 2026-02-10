---
description:
alwaysApply: true
---

# Claude Code Context - Christmas Air Internal Tools

## CRITICAL: Timezone Rules (READ FIRST)

**This company is in TEXAS (Central Time). All dates MUST be in Central Time, not UTC.**

### NEVER DO THIS:
```typescript
// WRONG - toISOString() converts to UTC, causing 6-hour date shifts!
const dateStr = new Date().toISOString().split('T')[0];
const dateStr = someDate.toISOString().split('T')[0];

// WRONG - Z suffix means UTC, not local time!
params.completedOnOrAfter = `${date}T00:00:00Z`;
```

### ALWAYS DO THIS:
```typescript
// CORRECT - Use local date components directly
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// CORRECT - For API timestamps, NO Z suffix (let API interpret as tenant's local time)
params.completedOnOrAfter = `${date}T00:00:00`;

// CORRECT - In daily-dash, use the helper functions from huddle-utils.ts:
import { getTodayDateString, getYesterdayDateString, getLocalDateString } from '@/lib/huddle-utils';
```

### Why This Matters:
- `new Date()` in JavaScript uses local time
- `toISOString()` converts that local time to UTC
- At 11pm Central on Jan 31, `toISOString().split('T')[0]` returns "2026-02-01" (wrong!)
- ServiceTitan API interprets timestamps without `Z` as tenant local time
- Using `Z` suffix caused ALL revenue queries to be off by 6 hours

## Project Overview

This monorepo contains internal tools for Christmas Air Conditioning & Plumbing:

| App | URL | Stack | Port |
|-----|-----|-------|------|
| **That's a Wrap** (`/debrief-qa`) | https://debrief.christmasair.com | Python/FastAPI | 8000 |
| **Daily Dash** (`/daily-dash`) | https://dash.christmasair.com | Next.js | 3001 |
| **Marketing Hub** (`/marketing-hub`) | https://marketing.christmasair.com | Next.js | 3002 |
| **Internal Portal** (`/internal-portal`) | https://portal.christmasair.com | Next.js | 3000 |
| **AR Collections** (`/ar-collections`) | https://ar.christmasair.com | Next.js | 3003 |
| **Job Tracker** (`/job-tracker`) | https://track.christmasair.com | Next.js | 3004 |
| **AP Payments** (`/ap-payments`) | https://ap.christmasair.com | Next.js | 3005 |

### Shared Package (`/packages/shared`)
Common code shared across all Next.js apps:
- `@christmas-air/shared/permissions` - Permission types and utilities
- `@christmas-air/shared/auth` - Auth configuration factory
- `@christmas-air/shared/types` - Shared TypeScript types
- `@christmas-air/shared/components` - Shared UI components

#### Standard UI Components

**DateRangePicker** - Standard date range selector for all apps
```tsx
import { DateRangePicker, DateRange } from '@christmas-air/shared/components';

// Usage
const [range, setRange] = useState<DateRange>({ start: '2026-01-01', end: '2026-01-31' });

<DateRangePicker
  value={range}
  onChange={(newRange) => setRange(newRange)}
  dataDelay={3}  // Optional: shows "Data has a 3-day delay" notice
/>
```
- Uses CSS variables for theming (--christmas-green, --bg-card, etc.)
- Presets: Today, Yesterday, This Week, Last Week, Month to Date, Last Month, Quarter to Date, Last Quarter, Year to Date, Last Year
- Custom date range with Start/End inputs
- Compact 2-column grid layout
- Click outside to close

## Current Features (Jan 2026)

### Marketing Hub

**GBP Posts** - Create and publish posts to all 8 Google Business Profile locations
- Post types: Standard, Event, Offer
- Media library with Supabase Storage
- Per-location publish status tracking

**GBP Performance** - Dashboard with location metrics
- Views, Clicks, Calls, Directions from Business Profile Performance API
- Location comparison chart (bar chart)
- Data cached in `gbp_insights_cache` table
- Note: 2-3 day delay from Google

**LSA Dashboard** (`/lsa`) - Local Service Ads tracking
- Performance cards: Total Leads, Spend, Cost/Charged Lead, Impressions
- HVAC vs Plumbing breakdown with charge rates
- Location Performance tab showing per-account metrics
- All Leads tab with trade filter
- Trade detection via `category_id` field (hvac/heating → HVAC, plumb/drain → Plumbing)
- Key metric: Cost/Charged Lead (ignores free returning customer leads)
- Note: Google Ads API query cannot include PII fields (phone numbers) without special permissions

**Task Management** - Daily/weekly/monthly marketing tasks

### Daily Dash

**Revenue Dashboard** - Pacing metrics with ServiceTitan integration
- Today/Week/Month/Quarter/Year cards with revenue + sales
- 18-month trend chart (HVAC green, Plumbing gold)
- Trade breakdown: HVAC (Install/Service/Maintenance) and Plumbing
- Pacing markers showing ahead/behind pace
- Saturday = 0.5 business day, Sunday = 0

**Revenue Formula**: `Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue`

**Reviews Dashboard** - Google reviews with team mentions
- Stats: total reviews, average rating, response rate
- Team leaderboard by mentions
- Photo/video indicators on reviews
- Editable team mentions

**Permissions System** - JSONB-based permissions per app
- Roles: Owner (all perms), Manager, Employee
- Check with `hasPermission(role, permissions, app, permission)`

### That's a Wrap (Debrief QA)

**Job QA Tool** - ServiceTitan job review for dispatchers
- Auto QA suggestions based on ServiceTitan data
- Equipment at Location banner (workaround: client-side filter due to API bug)
- Invoice line items display
- Financing context banners
- Membership visit tracking ("Visit 1 of 2")
- AI invoice review (Gemini Flash, ~$0.00015/review)
- Happy Call tracking column

### AR Collections

**Accounts Receivable Management** - Track and collect outstanding invoices
- Dashboard with aging summary and key metrics
- Invoice list views (Install vs Service)
- Communication logging for customer follow-ups
- Financing tracking
- Activity history
- Reports and analytics
- ServiceTitan integration for invoice data

### Job Tracker ("Pizza Tracker")

**Customer-Facing Job Tracking** - Unique links for customers to track job progress
- Public tracker page at `track.christmasair.com/[trackingCode]` (no login required)
- Progress timeline with milestone status
- Trade-based theming (HVAC = green, Plumbing = gold)
- Customer notification preferences (SMS/email)

**Staff Dashboard** - Create and manage job trackers
- Create trackers manually or auto-create from ServiceTitan
- Update milestones with customer-visible notes
- Copy shareable tracker links

**Milestone Templates** - Reusable milestone sets
- Default templates: HVAC Install (7 steps), HVAC Repair (5 steps), Water Heater Install (4 steps)
- Templates by trade and job type
- Auto-progress calculation

**Notifications** - Keep customers informed
- SMS via Twilio
- Email via Resend
- Auto-send on milestone completion
- Welcome and completion notifications

**ServiceTitan Integration**
- Auto-create trackers for install jobs (cron: 8 AM weekdays)
- Sync job status (cron: every 2 hours)
- Pull customer info and job details

### AP Payments

**Subcontractor Payment Tracking** - Manage contractor payments for install jobs
- Dashboard with summary stats (unassigned jobs, outstanding payments, total paid)
- Install jobs synced from ServiceTitan (HVAC + Plumbing install business units)
- Job assignment: In-House or Contractor with auto-suggested rates
- Contractor management with rate cards (per trade + job type)
- Payment workflow: None → Requested → Approved → Paid
- Activity log for all assignment and payment changes
- Cron sync every 2 hours during business hours + daily 6am full sync
- Database tables: ap_contractors, ap_contractor_rates, ap_install_jobs, ap_activity_log, ap_sync_log

### Internal Portal (Admin)

**User Management** (`/admin/users`) - Centralized user provisioning
- Create, edit, deactivate users across all apps
- Per-app permission toggles
- Role assignment (Owner, Manager, Employee)
- All apps link here for user management

**Audit Log** (`/admin/audit`) - Track user/permission changes
- Who changed what, when
- Stored in `portal_audit_log` table

**SSO Endpoints** - APIs for cross-app authentication
- `POST /api/users/validate` - Validate user by email (used during Google OAuth callback)
- `POST /api/sso/validate` - Decode NextAuth JWT for auto-login from portal session cookie

## SSO Architecture

All apps share authentication via NextAuth session cookie on `.christmasair.com`:

1. **User logs into any Next.js app** → Session cookie created
2. **User visits another Next.js app** → Same cookie, auto-authenticated
3. **User visits Python app (debrief-qa)** → Cookie read, validated via Portal API, local session created

### Python SSO Flow (debrief-qa)
```
User visits debrief.christmasair.com
    ↓
Check for __Secure-next-auth.session-token cookie
    ↓
Call portal.christmasair.com/api/sso/validate
    ↓
Portal decodes JWT, returns user info
    ↓
Auto-create local Dispatcher record if needed
    ↓
Create local session → redirect to queue
```

### User Provisioning
1. Admin creates user in Portal (`/admin/users`)
2. User can immediately access all apps via SSO
3. Local records auto-created on first visit

## Key Technical Details

### ServiceTitan Integration (Daily Dash)
- No webhook access - uses polling via `/api/sync`
- Business Unit mapping:
  - HVAC: Install, Service (includes Commercial/Mims), Maintenance
  - Plumbing: All plumbing business units combined

### Google APIs Used
| API | App | Purpose |
|-----|-----|---------|
| Business Profile | Marketing Hub, Daily Dash | GBP posts, reviews, performance metrics |
| Google Ads | Marketing Hub | LSA leads and performance |

### Database (Supabase)
Key tables:
- `portal_users` - **Single source of truth** for all user accounts across all apps. JSONB `permissions` column for app-specific permissions.
- `dispatchers` - Legacy debrief table (still exists but no longer used for auth - users validated against portal_users)
- `portal_audit_log` - Tracks user/permission changes
- `google_reviews` - Synced reviews with `team_members_mentioned`
- `gbp_posts`, `gbp_post_locations`, `gbp_media` - Post management
- `gbp_insights_cache` - Daily GBP metrics
- `lsa_leads`, `lsa_daily_performance`, `lsa_accounts` - LSA data
- `huddle_daily_snapshots`, `trade_daily_snapshots` - Revenue caching
- `dash_monthly_targets`, `dash_quarterly_targets` - Target configuration
- `marketing_tasks` - Task tracking
- `job_trackers` - Customer job tracking records
- `tracker_milestones` - Progress milestones for each tracker
- `tracker_templates`, `tracker_template_milestones` - Reusable milestone templates
- `tracker_activity` - Audit log for tracker changes
- `tracker_notifications` - Notification send history
- `ap_contractors` - Subcontractor records
- `ap_contractor_rates` - Rate cards per contractor/trade/job type
- `ap_install_jobs` - Install jobs synced from ServiceTitan with assignment and payment tracking
- `ap_activity_log` - Audit trail for assignment and payment changes
- `ap_sync_log` - Cron sync operation history

### Permission Groups
```typescript
// daily_dash
can_edit_targets, can_reply_reviews, can_edit_huddle_notes, can_sync_data

// marketing_hub
can_manage_gbp_posts, can_view_analytics, can_view_social, can_manage_tasks, can_sync_data

// debrief_qa
can_view_all_jobs, can_manage_users, can_manage_spot_checks

// admin_panel
can_manage_users, can_view_audit_log

// ar_collections
can_view_invoices, can_update_invoices, can_log_communications, can_view_reports, can_manage_settings

// job_tracker
can_view_trackers, can_manage_trackers, can_manage_templates, can_sync_data

// ap_payments
can_view_jobs, can_manage_assignments, can_manage_payments, can_manage_contractors, can_sync_data
```

## Deployment

### That's a Wrap - DigitalOcean Droplet
```bash
# Deploy from Mac
~/deploy-debrief.sh "commit message"

# Server access
ssh root@64.225.12.86

# Server paths
/opt/debrief-qa/debrief-qa/     # App code
/opt/debrief-qa/debrief-qa/.env # Credentials

# Commands
systemctl status debrief-qa
systemctl restart debrief-qa
journalctl -u debrief-qa -f
```

### Daily Dash, Marketing Hub, Internal Portal, AR Collections & Job Tracker - Vercel
```bash
cd daily-dash && vercel --prod
cd marketing-hub && vercel --prod
cd internal-portal && vercel --prod
cd ar-collections && vercel --prod
cd job-tracker && vercel --prod
cd ap-payments && vercel --prod
```

Cron jobs configured in `vercel.json` - see **Cron Schedules** section below for details.

Backfill endpoint: `POST /api/huddle/backfill` (requires `CRON_SECRET` header)

## Cron Schedules

All Vercel crons use UTC. Times shown are Central Time (CT). During daylight saving (Mar-Nov), schedules shift 1 hour later.

### Daily Dash (`daily-dash/vercel.json`)

| Endpoint | Schedule | CT Time | Purpose |
|----------|----------|---------|---------|
| `/api/trades/sync` | `0 12 * * *` | 6am daily | Daily trade snapshots for dashboard/pacing |
| `/api/trades/sync-monthly` | `0 12 * * *` | 6am daily | Monthly trend chart data |
| `/api/huddle/snapshots/sync` | `0 12 * * *` | 6am daily | Huddle KPIs |
| `/api/reviews/sync` | `0 0,14-23 * * *` | 8am-6pm hourly | Google reviews (near real-time) |

### Marketing Hub (`marketing-hub/vercel.json`)

| Endpoint | Schedule | CT Time | Purpose |
|----------|----------|---------|---------|
| `/api/analytics/sync` | `0 12 * * *` | 6am daily | Website analytics |
| `/api/gbp/insights/sync` | `0 12 * * *` | 6am daily | GBP performance (2-3 day delay from Google) |
| `/api/social/sync` | `0 12 * * *` | 6am daily | Social media data |
| `/api/lsa/sync` | `0 0,14-23 * * *` | 8am-6pm hourly | LSA leads (near real-time) |
| `/api/leads/sync/st-calls` | `0 0,14-23 * * *` | 8am-6pm hourly | ServiceTitan calls (near real-time) |

### AR Collections (`ar-collections/vercel.json`)

| Endpoint | Schedule | CT Time | Purpose |
|----------|----------|---------|---------|
| `/api/cron/sync` | `0 12 * * *` | 6am daily | AR invoices from ServiceTitan |
| `/api/cron/sync` | `0 14-23 * * 1-5` | 8am-5pm Mon-Fri hourly | Intraday AR updates |
| `/api/cron/sync` | `0 0 * * 2-6` | 6pm Mon-Fri | End of day sync |
| `/api/cron/weekly-slack` | `0 * * * *` | Every hour | Slack notifications |

### AP Payments (`ap-payments/vercel.json`)

| Endpoint | Schedule | CT Time | Purpose |
|----------|----------|---------|---------|
| `/api/cron/sync` | `0 12 * * *` | 6am daily | Full sync of install jobs from ServiceTitan |
| `/api/cron/sync` | `0 14,16,18,20,22 * * 1-5` | 8am-4pm Mon-Fri every 2hrs | Intraday install job sync |

### Data Freshness Notes

| Data Source | Delay | Sync Frequency |
|-------------|-------|----------------|
| GBP Insights | 2-3 days (Google API limitation) | Daily |
| LSA Leads | Near real-time | Hourly |
| ServiceTitan Calls | Near real-time | Hourly |
| Google Reviews | Near real-time | Hourly |
| AR Invoices | Near real-time | Hourly (business hours) |
| AP Install Jobs | Near real-time | Every 2 hours (business hours) |

## Environment Variables

### Daily Dash
```
NEXTAUTH_URL, NEXTAUTH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
SERVICETITAN_CLIENT_ID, SERVICETITAN_CLIENT_SECRET, SERVICETITAN_TENANT_ID, SERVICETITAN_APP_KEY
CRON_SECRET
```

### Marketing Hub
Same as Daily Dash plus:
```
GOOGLE_BUSINESS_CLIENT_ID, GOOGLE_BUSINESS_CLIENT_SECRET, GOOGLE_BUSINESS_REFRESH_TOKEN
GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID
GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN
```

### Internal Portal
Same as Daily Dash plus:
```
INTERNAL_API_SECRET          # Shared secret for SSO API calls
```

### Debrief QA (Python)
```
PORTAL_URL=https://portal.christmasair.com
INTERNAL_API_SECRET          # Same as Internal Portal
```

### Job Tracker
Same as Daily Dash plus:
```
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER  # SMS notifications
RESEND_API_KEY                                               # Email notifications
NEXT_PUBLIC_APP_URL=https://track.christmasair.com          # For tracker links
```

### AP Payments
Same as Daily Dash:
```
NEXTAUTH_URL, NEXTAUTH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
SERVICETITAN_CLIENT_ID, SERVICETITAN_CLIENT_SECRET, SERVICETITAN_TENANT_ID, SERVICETITAN_APP_KEY
CRON_SECRET
```

## DNS (Namecheap)
- debrief.christmasair.com → A record → 64.225.12.86
- dash.christmasair.com → CNAME → Vercel
- marketing.christmasair.com → CNAME → Vercel
- portal.christmasair.com → CNAME → Vercel
- ar.christmasair.com → CNAME → Vercel
- track.christmasair.com → CNAME → Vercel
- ap.christmasair.com → CNAME → Vercel

## GitHub
- Private repo: https://github.com/n8dizzle/debrief-tools
- Deploy key configured on droplet

## Local Development
```bash
# Terminal 1 - Internal Portal
cd internal-portal && npm run dev  # http://localhost:3000

# Terminal 2 - Daily Dash
cd daily-dash && npm run dev       # http://localhost:3001

# Terminal 3 - Marketing Hub
cd marketing-hub && npm run dev    # http://localhost:3002

# Terminal 4 - AR Collections
cd ar-collections && npm run dev   # http://localhost:3003

# Terminal 5 - Job Tracker
cd job-tracker && npm run dev      # http://localhost:3004

# Terminal 6 - AP Payments
cd ap-payments && npm run dev      # http://localhost:3005
```

## Recent Changes Summary

**Feb 9, 2026**:
- **AP Payments MVP** - Subcontractor payment tracking at ap.christmasair.com
  - Dashboard with summary stats (unassigned jobs, outstanding/paid amounts)
  - Install jobs synced from ServiceTitan (HVAC + Plumbing install business units)
  - Job assignment modal: In-House or Contractor with rate card auto-fill
  - Contractor management with rate cards per trade/job type
  - Payment workflow: None → Requested → Approved → Paid with timestamps
  - Activity log for all changes
  - Database tables: ap_contractors, ap_contractor_rates, ap_install_jobs, ap_activity_log, ap_sync_log
  - Cron: Every 2 hours Mon-Fri + daily 6am full sync

**Feb 4, 2026**:
- **Cron Schedules Added** - Set up automated syncs across all apps:
  - Daily Dash: Reviews sync hourly 8am-6pm, trades/huddle sync daily 6am
  - Marketing Hub: LSA and ST calls sync hourly 8am-6pm, GBP/analytics daily 6am
  - AR Collections: Already had hourly syncs configured
- All cron endpoints now support both session auth (manual) and `CRON_SECRET` auth (scheduled)

**Jan 29, 2026**:
- **Job Tracker MVP** - Customer-facing job tracking ("Pizza Tracker") at track.christmasair.com
  - Public tracker page with progress timeline and milestone status
  - Staff dashboard for creating/managing trackers
  - Milestone templates (HVAC Install, HVAC Repair, Water Heater Install)
  - SMS (Twilio) and Email (Resend) notifications
  - ServiceTitan integration for auto-create and status sync
  - Database tables: job_trackers, tracker_milestones, tracker_templates, tracker_activity, tracker_notifications

**Jan 28, 2026**:
- **User Migration Complete** - Migrated all 19 users from debrief's `dispatchers` table to `portal_users`. Portal is now the single source of truth for all user management. Debrief validates users against portal on login via `/api/users/validate` endpoint.
- SSO & Centralized Admin - Shared package for permissions, centralized user management in Internal Portal, true SSO for Python app (debrief-qa), audit logging
- LSA Fix - Removed PII fields (phone numbers) from Google Ads API query that required special permissions; sync now working with 1,775+ leads
- Vercel Config - Fixed Marketing Hub by clearing Root Directory (was doubled path)

**Jan 25-26, 2026**: LSA Dashboard - HVAC/Plumbing breakdown, location performance, cost-per-charged-lead metrics, sync to Supabase

**Jan 24, 2026**: Marketing Hub launch, GBP Performance dashboard, Reviews page enhancements (team mentions editing, photo/video indicators), User permissions system, Saturday = 0.5 business day

**Jan 23, 2026**: Daily Dash deployed, 18-month trend chart, trade-level revenue tracking, mobile responsive redesign, total sales on cards, revenue calculation fix

**Jan 17, 2026**: Debrief-qa equipment/invoice banners, period toggle default change

**Jan 6-8, 2025**: Debrief-qa search, financing banners, membership tracking, happy call column
