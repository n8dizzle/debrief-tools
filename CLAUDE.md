---
description:
alwaysApply: true
---

# Claude Code Context - Christmas Air Internal Tools

## Project Overview

This monorepo contains internal tools for Christmas Air Conditioning & Plumbing:

| App | URL | Stack | Port |
|-----|-----|-------|------|
| **That's a Wrap** (`/debrief-qa`) | https://debrief.christmasair.com | Python/FastAPI | 8000 |
| **Daily Dash** (`/daily-dash`) | https://dash.christmasair.com | Next.js | 3001 |
| **Marketing Hub** (`/marketing-hub`) | https://marketing.christmasair.com | Next.js | 3002 |
| **Internal Portal** (`/internal-portal`) | portal.christmasair.com (not deployed) | Next.js | 3000 |

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
- `portal_users` - User accounts with JSONB `permissions` column
- `google_reviews` - Synced reviews with `team_members_mentioned`
- `gbp_posts`, `gbp_post_locations`, `gbp_media` - Post management
- `gbp_insights_cache` - Daily GBP metrics
- `lsa_leads`, `lsa_daily_performance`, `lsa_accounts` - LSA data
- `huddle_daily_snapshots`, `trade_daily_snapshots` - Revenue caching
- `dash_monthly_targets`, `dash_quarterly_targets` - Target configuration
- `marketing_tasks` - Task tracking

### Permission Groups
```typescript
// daily_dash
can_edit_targets, can_reply_reviews, can_edit_huddle_notes, can_sync_data

// marketing_hub
can_manage_gbp_posts, can_view_analytics, can_view_social, can_manage_tasks, can_sync_data

// debrief_qa
can_view_all_jobs
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

### Daily Dash & Marketing Hub - Vercel
```bash
cd daily-dash && vercel --prod
cd marketing-hub && vercel --prod
```

Cron jobs configured in `vercel.json`:
- Daily 6am CT: Sync yesterday's final numbers
- Hourly 8am-6pm Mon-Fri: Update today's running totals

Backfill endpoint: `POST /api/huddle/backfill` (requires `CRON_SECRET` header)

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

## DNS (Namecheap)
- debrief.christmasair.com → A record → 64.225.12.86
- dash.christmasair.com → CNAME → Vercel
- marketing.christmasair.com → CNAME → Vercel

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
```

## Recent Changes Summary

**Jan 25-26, 2026**: LSA Dashboard - HVAC/Plumbing breakdown, location performance, cost-per-charged-lead metrics, sync to Supabase

**Jan 24, 2026**: Marketing Hub launch, GBP Performance dashboard, Reviews page enhancements (team mentions editing, photo/video indicators), User permissions system, Saturday = 0.5 business day

**Jan 23, 2026**: Daily Dash deployed, 18-month trend chart, trade-level revenue tracking, mobile responsive redesign, total sales on cards, revenue calculation fix

**Jan 17, 2026**: Debrief-qa equipment/invoice banners, period toggle default change

**Jan 6-8, 2025**: Debrief-qa search, financing banners, membership tracking, happy call column
