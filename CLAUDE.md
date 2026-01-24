# Claude Code Context - Christmas Air Internal Tools

## Project Overview

This monorepo contains internal tools for Christmas Air Conditioning & Plumbing:

1. **That's a Wrap** (`/debrief-qa`) - LIVE at https://debrief.christmasair.com
2. **Internal Portal** (`/internal-portal`) - Simple intranet at portal.christmasair.com (not yet deployed)
3. **Daily Dash** (`/daily-dash`) - LIVE at https://dash.christmasair.com

## Recent Updates (Jan 23, 2026) - Trend Chart & Revenue Fixes

### Daily Dash - Trend Chart Improvements

#### Clickable Legend Filter
- Filter buttons in chart header: **All** | **HVAC** | **Plumbing**
- Click to show only selected trade's revenue bars
- Active filter shows highlighted state with trade color indicator

#### Trend Chart Data Caching
- Trend data cached in `trade_daily_snapshots` Supabase table
- Falls back to direct ServiceTitan API if cache incomplete
- Improves dashboard load times

#### December Data Fix
**Problem**: Dec 2024 and Dec 2025 showed identical values (Recharts merged them).
**Fix**: Month labels now include year: `"DEC '24"`, `"DEC '25"`

#### Trade Revenue for Trend Chart
**Important**: Trade breakdown uses `completedRevenue` only (not full Total Revenue formula).
This matches how ServiceTitan displays trade-level revenue (non-job revenue isn't attributed to trades).

---

### Daily Dash - Fixed Trade Revenue Calculation

**Problem**: Trade cards (HVAC/Plumbing) were showing incorrect revenue because:
1. `getTradeMetrics` was returning only Completed Revenue, not Total Revenue
2. Target department names didn't match API queries (lowercase vs Pascal Case)

**ServiceTitan's Formula**:
```
Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue
```

#### Changes Made

1. **`lib/servicetitan.ts`** - Fixed `getTradeMetrics()`:
   ```typescript
   // Before: revenue = completedRevenue (wrong)
   // After:  revenue = completedRevenue + nonJobRevenue + adjRevenue (correct)
   ```
   - Now matches ServiceTitan's "Total Revenue" exactly
   - Applies to HVAC, Plumbing, and all HVAC departments

2. **`app/api/targets/fix/route.ts`** - Fixed department names:
   - Changed from: `'hvac-install'`, `'plumbing'` (lowercase/hyphenated)
   - Changed to: `'HVAC Install'`, `'Plumbing'` (Pascal Case, matches API)
   - Daily targets now calculated from monthly ÷ business days
   - Cleans up old incorrect department entries

3. **`app/(dashboard)/settings/page.tsx`** - Dynamic target calculation:
   - Daily/weekly targets calculated from monthly targets
   - Business days: `[22, 19, 22, 22, 21, 22, 23, 21, 21, 23, 19, 23]`

4. **`app/api/huddle/route.ts`** - Fetch WTD/MTD live from ServiceTitan:
   - **Problem**: WTD/MTD were calculated from Supabase snapshots + today's live data
   - If snapshots were missing/stale, WTD/MTD values were wrong
   - **Solution**: Fetch Today, WTD, MTD directly from ServiceTitan in parallel
   ```typescript
   const [todayMetrics, wtdMetrics, mtdMetrics] = await Promise.all([
     stClient.getTradeMetrics(date),              // Today only
     stClient.getTradeMetrics(mondayStr, date),   // Monday through today
     stClient.getTradeMetrics(firstOfMonth, date) // First of month through today
   ]);
   ```
   - QTD/YTD still use snapshots (historical data)
   - Trade cards now show accurate WTD/MTD values

#### To Apply Fix

1. Deploy changes to production
2. Go to **Settings** page
3. Click **"Fix Targets"** to update department names
4. Click **"Sync 30 Days"** under Trade Revenue Sync to refresh historical data

#### Expected January 2026 Targets (after fix)
| Department | Monthly | Daily |
|------------|---------|-------|
| HVAC Install | $569,000 | $25,864 |
| HVAC Service | $124,000 | $5,636 |
| HVAC Maintenance | $31,000 | $1,409 |
| Plumbing | $130,000 | $5,909 |
| **TOTAL** | **$855,000** | **$38,864** |

---

## Previous Updates (Jan 23, 2026) - Dashboard Redesign

### Daily Dash - Dashboard Layout Redesign

#### New Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│  2026 ANNUAL PROGRESS            $401K / $15.8M    ███░░░  3%      │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  18 MONTH TREND                        [All] [HVAC] [Plumbing]     │
│  [Stacked Bar Chart: HVAC (green) + Plumbing (gold)]               │
└─────────────────────────────────────────────────────────────────────┘
───────────────────────── PACING METRICS ─────────────────────────────
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│   Today   │ │ This Week │ │This Month │ │This Quarter│
└───────────┘ └───────────┘ └───────────┘ └───────────┘
─────────────────────────── BY TRADE ─────────────────────────────────
┌─────────────────────────────────────────────────────────────────────┐
│  HVAC                                              MTD: $380K       │
│  [Today] [Week] [Month]  │  Install | Service | Maintenance        │
├─────────────────────────────────────────────────────────────────────┤
│  PLUMBING                                          MTD: $21.8K      │
│  [Today] [Week] [Month]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

#### New Components
1. **AnnualBanner** - Slim full-width progress bar for YTD revenue
   - Shows revenue vs target with percentage
   - Pacing marker and ahead/behind indicator

2. **TrendChart** - 18-month stacked bar chart using recharts
   - HVAC revenue: branded green (`#346643`)
   - Plumbing revenue: branded gold (`#B8956B`)
   - Custom tooltip showing HVAC, Plumbing, and Total
   - Fetches data in parallel for faster loading

3. **SectionDivider** - Styled dividers with gradient lines
   - "DAILY METRICS" and "BY TRADE" labels

#### Trade Section Changes
- **Reduced from 5 columns to 3**: Today, Week, Month (removed Quarter/Year)
- Quarter/Year data now shown in Annual Banner and Trend Chart
- MTD total displayed in trade section header

#### API Changes (`/api/huddle/route.ts`)
- Added `monthlyTrend` array to response (18 months of HVAC/Plumbing revenue)
- Parallel fetching of trade metrics for faster loading
- New type: `MonthlyTrendData` in `lib/supabase.ts`

#### Data Structure
```typescript
pacing.monthlyTrend = [
  {
    month: "2025-08",
    label: "AUG",
    hvacRevenue: 1200000,
    plumbingRevenue: 150000,
    totalRevenue: 1350000,
    goal: 1400000
  },
  // ... 18 months
]
```

---

## Previous Updates (Jan 23, 2026) - Mobile Responsiveness

### Daily Dash - Main Dashboard Mobile Support

#### Mobile Sidebar Navigation
- **Hamburger menu** appears on screens < 768px (md breakpoint)
- **Slide-in overlay** from left with dark backdrop
- **Close button** (X) inside sidebar on mobile
- Backdrop click closes sidebar
- Auto-closes on route navigation
- Body scroll locked when sidebar open

**Files:**
- `components/DashSidebar.tsx` - Added `isOpen`/`onClose` props, slide animation, backdrop
- `components/DashboardShell.tsx` - New client wrapper with hamburger button state
- `app/(dashboard)/layout.tsx` - Uses DashboardShell wrapper

#### Responsive Grid Layouts
| Component | Desktop | Mobile |
|-----------|---------|--------|
| Revenue Cards | 4 columns | 1 column (stacked) |
| HVAC Time Cards | 3 columns | 1 column |
| HVAC Departments | 3 columns | 1 column |
| Plumbing Cards | 3 columns | 1 column |

#### Responsive Component Updates
- **RevenueCard**: Revenue/Sales stack vertically on mobile, side-by-side on desktop
- **Header**: Shorter title on mobile ("Christmas Air" vs full name), smaller buttons
- **TrendChart**: `h-48` on mobile, `h-64` on desktop; labels use `interval="preserveStartEnd"` with `minTickGap={20}`
- **AnnualBanner**: Responsive text sizing, stacks on mobile
- **All containers**: Responsive padding (`p-3 sm:p-4` or `p-4 sm:p-5`)

#### Breakpoints Used
- `sm:` (640px) - Small phones to larger phones
- `md:` (768px) - Tablets and up (sidebar always visible)
- `lg:` (1024px) - Desktop

---

## Previous Updates (Jan 23, 2026) - Daily Dash Revenue Tracking

### Daily Dash - DEPLOYED to https://dash.christmasair.com

#### Revenue Calculation Fix - Now Matches ServiceTitan (within 0.14%)
**Problem**: MTD revenue was off from ServiceTitan because we were only using "Completed Revenue" instead of "Total Revenue".

**ServiceTitan's Formula**:
```
Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue
```

**Changes Made**:
1. Updated `lib/servicetitan.ts` - `getTotalRevenue()` now properly calculates:
   - `completedRevenue`: sum of `job.total` for completed jobs
   - `nonJobRevenue`: positive invoices with no job attached (memberships, etc.)
   - `adjRevenue`: negative invoices (refunds, credits)
   - `totalRevenue`: all three summed together

2. Added `adj-revenue` KPI to database for tracking adjustments

3. Updated API (`/api/huddle/route.ts`) to use `total-revenue` instead of `revenue-completed` for MTD/WTD/QTD calculations

4. Updated sync routes to handle new revenue breakdown

#### Pacing Markers on Revenue Cards
Shows where revenue should be based on elapsed business time:
- **White vertical marker** on progress bar showing expected position
- **"Ahead of pace" / "Behind pace"** indicator with expected percentage
- **Business hours**: Mon-Sat 8am-6pm (10 hours per day)
- **Daily pacing**: Based on hours elapsed in business day
- **Weekly pacing**: Based on business days elapsed (Mon-Sat = 6 days)
- **Monthly pacing**: Based on business days elapsed vs total in month
- **Quarterly pacing**: Based on business days elapsed in quarter
- **Annual pacing**: Uses seasonal monthly target weights (calculated server-side)

#### Annual Pacing Calculation (Fixed Jan 23, 2026)
**Problem**: Previous calculation only worked for January - it didn't sum prior months' targets.

**Solution**: Moved calculation to server-side API (`/api/huddle/route.ts`) where all monthly targets are available.

**Formula**:
```
Expected YTD = Sum of completed months' targets (100%) + Current month's target × (business days elapsed / total business days)
```

**Example for July 15th** (halfway through July):
- Jan-Jun targets complete: $855K + $703K + $963K + $1.25M + $1.73M + $2M = $7.5M
- July prorated (50%): $2M × 0.5 = $1M
- Expected YTD: $8.5M
- As % of annual ($15.75M): **54%** (not 58% from equal 7/12 weights)

**Code locations**:
- Server calculation: `daily-dash/app/api/huddle/route.ts` - `expectedAnnualPacingPercent`
- Frontend usage: `daily-dash/app/(dashboard)/page.tsx` - `pacing?.expectedAnnualPacingPercent`
- Monthly targets: `dash_monthly_targets` table with seasonal weights from Google Sheet

#### Total Sales Added to Dashboard Cards (Jan 23, 2026)
Dashboard now shows both **Revenue** and **Sales** on the top 4 cards (Today, This Week, This Month, This Quarter).

**Card layout**:
```
┌─────────────────────────────────┐
│ TODAY                      74%  │
│                                 │
│  $28.9K    │    $27.9K         │
│  REVENUE   │    SALES          │
│─────────────────────────────────│
│  of $38,864 target             │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬│▬▬▬▬▬▬▬▬▬▬▬▬   │
│  ▼ Behind pace    Expected: 100%│
└─────────────────────────────────┘
```

**Design elements**:
- **Vertical divider** between Revenue and Sales columns
- **Horizontal separator** above target/progress section
- **Uppercase labels** with letter-spacing (REVENUE, SALES)
- Revenue in cream/white, Sales in gold
- Compact formatting ($38.9K instead of $38,864)
- Thinner progress bar (1.5px) for subtlety
- Softer percentage badge styling

**What is "Total Sales"?**
Matches ServiceTitan's "Total Sales" metric:
- **Definition**: Sum of sold estimate subtotals
- **Calculation**: Sum of `estimate.subtotal` where `status = 'Sold'` and `soldOn` is within the date range
- Different from revenue (which is based on completed jobs and invoices)

**Code changes**:
1. `lib/servicetitan.ts`:
   - Added `STEstimate` interface
   - Added `getSoldEstimates(soldOnOrAfter, soldBefore)` method
   - Added `getTotalSales(date)` method

2. `app/api/huddle/route.ts`:
   - Added sales queries: `todaySales`, `wtdSales`, `mtdSales`, `qtdSales`
   - Added to pacing response object

3. `app/api/huddle/snapshots/sync/route.ts` and `backfill/route.ts`:
   - Added `total-sales` KPI case

4. `app/(dashboard)/page.tsx`:
   - Updated `PacingData` interface with sales fields
   - Updated `RevenueCard` component to accept optional `sales` prop
   - Added `formatCurrencyCompact()` for K/M formatting

**Database**:
- Added `total-sales` KPI to `huddle_kpis` table (same department as `total-revenue`)

**To backfill historical sales data**:
```bash
curl -X POST "https://dash.christmasair.com/api/huddle/backfill" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-01", "endDate": "2026-01-23"}'
```

#### Dashboard Layout
```
┌────────────┬────────────┬────────────┬────────────┐
│   TODAY    │  THIS WEEK │ THIS MONTH │THIS QUARTER│  (Revenue + Sales cards)
└────────────┴────────────┴────────────┴────────────┘
┌────────────────────────────────────────────────────┐
│                    THIS YEAR                       │  (Annual revenue card)
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│  HVAC                                              │
│  ┌─────┬─────┬─────┬─────┬─────┐                  │
│  │Today│Week │Month│Qtr  │Year │  Time periods    │
│  └─────┴─────┴─────┴─────┴─────┘                  │
│  ┌──────────┬──────────┬──────────┐               │
│  │ Install  │ Service  │Maintenance│  Departments │
│  └──────────┴──────────┴──────────┘               │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│  PLUMBING                                          │
│  ┌─────┬─────┬─────┬─────┬─────┐                  │
│  │Today│Week │Month│Qtr  │Year │  Time periods    │
│  └─────┴─────┴─────┴─────┴─────┘                  │
└────────────────────────────────────────────────────┘
```

#### Trade-Level Revenue Tracking (Jan 23, 2026)
Trade sections now show **real data** from ServiceTitan, filtered by business unit.

**Business Unit Mapping:**
```
HVAC Trade (excludes "HVAC - Sales"):
  - HVAC - Install      → Install department
  - HVAC - Service      → Service department
  - HVAC - Commercial   → Service department (combined)
  - Mims - Service      → Service department (combined)
  - HVAC - Maintenance  → Maintenance department

Plumbing Trade (all combined):
  - Plumbing - Install
  - Plumbing - Service
  - Plumbing - Maintenance
  - Plumbing - Sales
  - Plumbing - Commercial
```

**API Changes** (`lib/servicetitan.ts`):
- `getBusinessUnits()` - Fetches and caches all business units
- `getBusinessUnitIdsForTrade(trade)` - Returns IDs for HVAC or Plumbing
- `getBusinessUnitIdsForHVACDepartment(dept)` - Returns IDs for Install/Service/Maintenance
- `getTradeMetrics(startDate, endDate)` - Optimized method that fetches all trade data in one API call

**Data Structure** (returned by `/api/huddle`):
```typescript
pacing.trades = {
  hvac: {
    today: { revenue: number, departments: { install, service, maintenance } },
    wtd: { ... },
    mtd: { ... },
    qtd: { ... },
    ytd: { ... },
  },
  plumbing: {
    today: { revenue: number },
    wtd: { ... },
    mtd: { ... },
    qtd: { ... },
    ytd: { ... },
  }
}
```

**UI Components:**
- `MiniTradeCard` - Compact card matching company revenue card style
- Shows revenue, percentage, progress bar with pacing marker
- "Ahead/Behind" indicator based on time elapsed

**Target Estimates** (for percentage calculation):
- HVAC: ~85% of company targets
- Plumbing: ~15% of company targets
- TODO: Add actual trade-specific targets to database

#### Middleware Fix for Cron Auth
Added bypass for cron endpoints in `middleware.ts`:
- `/api/huddle/backfill` - uses `CRON_SECRET` header auth
- `/api/huddle/snapshots/sync` - uses `CRON_SECRET` header auth

#### Environment Variables
- `NEXTAUTH_URL=http://localhost:3001` (was 3000, caused OAuth redirect issues)
- `CRON_SECRET` - Required for backfill/sync endpoints

#### Google OAuth Setup
Must add `http://localhost:3001/api/auth/callback/google` to Google Cloud Console OAuth credentials for local development.

### Previous Jan 23 Updates

#### Split Internal Portal into Two Apps
Separated the monolithic internal-portal into two independent Next.js applications:

**Internal Portal** (`/internal-portal`) - Port 3000
- Simple company intranet with tools/links
- Routes: `/`, `/login`, `/preview`, `/admin/*`
- API: `/api/auth/*`, `/api/tools/*`, `/api/users/*`, `/api/departments`, `/api/stats`
- Deployment: portal.christmasair.com

**Daily Dash** (`/daily-dash`) - Port 3001
- Dashboard for daily operations tracking
- Routes: `/`, `/pacing`, `/huddle`, `/huddle/history`, `/reviews`, `/settings`, `/[dept]`
- API: `/api/huddle/*`, `/api/reviews/*`, `/api/targets/*`, `/api/departments`
- Features organized in `/features/pacing/` and `/features/huddle/`
- Deployment: dash.christmasair.com

**Local Development:**
```bash
# Terminal 1 - Internal Portal
cd internal-portal && npm run dev  # http://localhost:3000

# Terminal 2 - Daily Dash
cd daily-dash && npm run dev       # http://localhost:3001
```

### Daily Dash - Daily Huddle Data Sync Architecture (NOT YET DEPLOYED)
- **Problem Solved**: MTD/WTD numbers were incorrect because data sync was manual-only
- **Automated Daily Sync** via Vercel Cron Jobs:
  - Daily at 6am CT: Syncs yesterday's final numbers
  - Hourly 8am-6pm Mon-Fri: Updates today's running totals
- **Backfill Endpoint** (`/api/huddle/backfill`):
  - Syncs historical data for any date range
  - Rate-limited to avoid API throttling (500ms between dates)
  - Skips dates that already have data (configurable)
- **Sync Status Dashboard**:
  - Shows data completeness percentage
  - Warns when MTD data is incomplete
  - One-click backfill button for owners
  - Last sync timestamp indicator
- **API Endpoints**:
  - `POST /api/huddle/backfill` - Backfill date range
  - `GET /api/huddle/backfill` - Check data completeness
  - `GET /api/huddle/sync-status` - Get sync status
- **Environment Variable**: `CRON_SECRET` for cron authentication

### Deployment Checklist for Daily Dash
```bash
# 1. Add CRON_SECRET to Vercel environment variables
# Generate with: openssl rand -hex 32

# 2. Deploy to Vercel (vercel.json configures cron jobs)
vercel --prod

# 3. After deploy, run initial backfill via curl or dashboard
curl -X POST "https://dash.christmasair.com/api/huddle/backfill" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-01", "endDate": "2026-01-22", "skipExisting": true}'
```

## Previous Updates (Jan 17, 2026)

### That's a Wrap (debrief-qa) - Deployed
- **Equipment at Location Banner** - Shows installed equipment on the ServiceTitan location record
  - Displays near "Equipment Added to ST Location?" question
  - Shows equipment name, serial number, install date, manufacturer/model
  - Highlights items "Added Today" in green if install date matches job date
  - Links to view location in ServiceTitan
  - **Note:** ServiceTitan API ignores `locationId` filter - uses client-side filtering
- **Invoice Line Items Banner** - Shows materials/equipment on the invoice
  - Displays near "Materials & Equipment on Invoice" question
  - Summary counts: Materials | Equipment | Services
  - Collapsible list with item name, quantity, price
  - Icons differentiate material vs equipment vs service
  - Links to view invoice in ServiceTitan
- **Dashboard Period Toggle** - Default changed from "today" to "this_month"
  - Period toggle now shows even when no data available

### ServiceTitan Equipment API Workaround
The ServiceTitan `installed-equipment` API **ignores the `locationId` filter parameter** and returns equipment from ALL locations. Solution:
1. Fetch up to 5,000 equipment items (10 pages × 500)
2. Filter client-side by matching `eq.locationId == job.locationId`
3. Store only equipment at the specific job's location

### That's a Wrap (debrief-qa) - NOT YET DEPLOYED
- **AI-Powered Invoice Review** - Uses Google Gemini Flash to analyze invoice summaries
  - Scores invoice quality 1-10 with feedback notes
  - Pre-fills invoice score slider with AI suggestion
  - Blue "AI suggests" badges show suggested values
  - Cost: ~$0.00015 per review
- **Auto QA Suggestions** - Pre-selects form fields based on ServiceTitan data:
  - Photos: Pass if photo_count > 0
  - Payment: Pass if payment_collected
  - Estimates: Pass if estimate_count > 0, N/A if not opportunity job
  - Membership: Pass if membership_sold, N/A if customer has active membership
  - Materials: Pass if materials/equipment on invoice
- **New API Endpoint** - `/api/run-ai-reviews` to backfill AI reviews on existing tickets
- **Environment Variable Required**: `GOOGLE_AI_API_KEY` for Gemini API

### Deployment Steps for AI Review Feature
```bash
# 1. SSH to server
ssh root@64.225.12.86

# 2. Run migration to add new columns
cd /opt/debrief-qa/debrief-qa
python migrations/add_ai_review_columns.py

# 3. Install new dependency
pip install google-generativeai

# 4. Add API key to .env
echo "GOOGLE_AI_API_KEY=your-key-here" >> .env

# 5. Restart app
systemctl restart debrief-qa

# 6. Backfill AI reviews on existing pending tickets
curl -X POST "http://localhost:8000/api/run-ai-reviews?limit=100&status=pending"
```

## Previous Updates (Jan 8, 2025)

### That's a Wrap (debrief-qa) - Deployed
- **Membership Visit Tracking** - Shows visit count (e.g., "Visit 1 of 2") for tune-up jobs
  - HVAC: 2 visits total (heat + cool counted together)
  - Plumbing: 1 visit
  - Shows if visit is FREE or PAYMENT NEEDED
  - Displays visit type context (Hvac Heat, Hvac Cool, Plumbing)
- **Membership Payment Info** - Shows in membership banner:
  - Price + billing frequency (e.g., $150.00/annual)
  - Last payment date + amount (e.g., Jun 21, 2024 - $150.00)
- **Tune-up Detection** - `Maintenance` and `Maintenance Commercial` job types detected using season:
  - Nov-Mar = heating tune-up
  - Apr-Oct = cooling tune-up
  - Explicit keywords (heat/cool) override season
  - "Inspection" excluded (not a tune-up)

## Previous Updates (Jan 7, 2025)

### That's a Wrap (debrief-qa) - Deployed
- **Happy Call column** on dispatcher dashboard - shows count of happy calls completed (marked Pass) with ratio vs total debriefs

## Previous Updates (Jan 6, 2025)

### That's a Wrap (debrief-qa) - Deployed
- **Search bar** on queue page - filter by job #, customer name, or technician
- **Financing context banners** - Synchrony, WellsFargo, Wisetack, Ally, Buydown with verification reminders
- **Composite score** displayed in top right of debrief view
- **Invoice score** added to grid, highlights red if below 7
- **Auto-select Pass** for verified payments
- **Check deposit status** - shows mobile deposit vs needs drop-off
- **Payment method** visible in completed debrief view
- Payment lookup improvements (customer ID filter, 90-day lookback, client-side filtering)

### Daily Dash (daily-dash) - Not Deployed Yet
- **Reviews dashboard** - Added recharts for data visualization
- **API auth fix** - Added `credentials: 'include'` to fetch calls
- **Stats API** - Extended types for daily counts and period tracking
- Better error logging on API failures

## Current Deployment Status

See `DEPLOYMENT_STATUS.md` for full details.

### That's a Wrap - PRODUCTION
- **URL**: https://debrief.christmasair.com
- **Server**: DigitalOcean Droplet (64.225.12.86)
- **Deploy**: `~/deploy-debrief.sh "commit message"` from Mac

### Internal Portal - NOT DEPLOYED
- Planned for Vercel at portal.christmasair.com
- Simple tools/links intranet

### Daily Dash - DEPLOYED
- **URL**: https://dash.christmasair.com
- **Host**: Vercel
- **Deploy**: `cd daily-dash && vercel --prod`
- Pacing, huddle, reviews dashboards

## Key Information

### ServiceTitan Integration
- App uses ServiceTitan API to pull job data
- **No webhook access** - uses polling via `/api/sync` endpoint
- Cron job syncs every 5 minutes
- Manual sync button on queue page

### Server Access
```bash
ssh root@64.225.12.86
```

### Important Paths on Server
```
/opt/debrief-qa/debrief-qa/     # App code
/opt/debrief-qa/debrief-qa/.env # Credentials (not in git)
```

### Useful Server Commands
```bash
systemctl status debrief-qa      # Check if running
systemctl restart debrief-qa     # Restart app
journalctl -u debrief-qa -f      # View logs
curl -X POST http://localhost:8000/api/sync  # Trigger sync
```

## Development Notes

- The repo root contains three projects as subfolders:
  - `/debrief-qa` - Python/FastAPI (port 8000)
  - `/internal-portal` - Next.js (port 3000)
  - `/daily-dash` - Next.js (port 3001)
- Always test locally before deploying
- Database: SQLite for debrief-qa (on server), Supabase for portal/dash

## DNS (Namecheap)
- debrief.christmasair.com -> A record -> 64.225.12.86
- portal.christmasair.com -> Not configured yet
- dash.christmasair.com -> CNAME -> Vercel (configured)

## GitHub
- Private repo: https://github.com/n8dizzle/debrief-tools
- Deploy key configured on droplet for pulls
