# Debrief QA - Development Log

This log tracks changes made across development sessions. Update this when making significant changes.

---

## 2026-01-04 - Session: Multi-Tech & Invoice Author Feature

### Changes Made

**1. Database Schema Updates** (`app/database.py`)
- Added `all_techs` column (JSON) - stores list of all technicians on a job: `[{"id": 123, "name": "John Doe"}, ...]`
- Added `invoice_author` column (String) - stores who wrote the invoice summary

**2. ServiceTitan API Updates** (`app/servicetitan.py`)
- Updated `enrich_job_data()` to fetch ALL technicians via appointment-assignments endpoint
- Extracts invoice author from `invoices[0].employeeInfo.name`
- Cleans email-based names (e.g., "jordans@christmasair.com" → "jordans")
- Fixed payment status bug: ServiceTitan returns `balance` as STRING not number, so `"0.00" == 0` was always False
- Changed attachments endpoint from `jpm/v2` to `forms/v2` (correct API)
- Refactored `categorize_job_type()` to support new format: "PREFIX - Description" (e.g., "SERVICE - T/U-Res-Mem")

**3. Webhook Updates** (`app/webhook.py`)
- Both `process_webhook()` and `manual_add_job()` now store `all_techs` and `invoice_author`

**4. UI Updates**

*Queue Page* (`templates/queue.html`):
- Tech name shows "+N" indicator if multiple techs; hover reveals full list
- Invoice summary tooltip shows author ("Written by: ...")
- Added "Sync from ST" button with loading animation
- Tooltips on stat cards converted to hover popups (more readable)

*Debrief Page* (`templates/debrief.html`):
- Shows all technicians comma-separated (instead of just primary)
- Invoice summary header shows "Written by: [author]"
- Removed location/address field from job details grid

**5. App Branding**
- Renamed from "The Nice List" to "That's a Wrap"
- Tagline: "Job ticket review and grading"

### Database Migration Note
New columns added to `tickets_raw` table. Existing jobs won't have `all_techs` or `invoice_author` populated - only new jobs via webhook or manual sync will have this data.

To backfill existing jobs, you could re-sync them via the API.

### Payment Status Fix
Ran SQL to fix existing data:
```sql
UPDATE tickets_raw SET payment_collected = 1 WHERE invoice_balance = 0.0 AND invoice_total > 0;
```

---

## 2026-01-04 - Session: Dashboard Redesign with Trade Performance

### Changes Made

**1. Database Schema Updates** (`app/database.py`)
- Added `equipment_added` column (CheckStatus enum) - tracks if tech added equipment to ST location
- Added `equipment_added_notes` column (Text) - notes for equipment added check

**2. Supabase Migration Applied**
```sql
ALTER TABLE debrief_sessions
ADD COLUMN IF NOT EXISTS equipment_added check_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS equipment_added_notes TEXT;
```

**3. Debrief Form Updates** (`templates/debrief.html`)
- Added "Equipment Added to ST Location?" checklist item (#8)
- Options: Yes (pass), No (fail), N/A
- Includes optional notes field

**4. API Updates** (`app/main.py`)
- Updated form submission handler to save `equipment_added` and `equipment_added_notes`
- Added `trade_performance` data to `/api/dashboard` endpoint
- Removed `pending_jobs` list from dashboard API (replaced with `pending_count`)
- New trade performance metrics calculated by trade type (HVAC vs Plumbing):
  - `photos_pass_rate`
  - `payment_pass_rate`
  - `estimates_pass_rate`
  - `avg_invoice_score`
  - `equipment_added_rate`

**5. Dashboard Redesign** (`templates/dashboard.html`)
- Added new "Performance by Trade" section with 5 metric cards
- Each card shows HVAC vs Plumbing side-by-side comparison
- Visual progress bars with color coding (green for HVAC, blue for Plumbing)
- Trophy icon shows winning trade for each metric
- Cards: Photos, Payment, Estimates, Invoice Score, Equipment Added
- Removed pending jobs list (users go to Queue page instead)
- Kept dispatcher and technician performance tables below

### Files Modified
| File | Change |
|------|--------|
| `app/database.py` | Added `equipment_added`, `equipment_added_notes` to DebriefSession |
| `app/main.py` | Updated form handler, added trade_performance to dashboard API |
| `templates/debrief.html` | Added Equipment Added checklist item |
| `templates/dashboard.html` | Redesigned with 5 trade performance cards |

### Notes
- Trade performance metrics are calculated for "This Month" period
- Cards show 0% until debriefs are completed and saved
- The goal is to create friendly competition between HVAC and Plumbing teams

---

## 2026-01-04 - Session: Opportunity Job Tracking

### Changes Made

**1. Database Schema Updates** (`app/database.py`)
- Added `is_opportunity` column (Boolean) - true if job has tags with `isConversionOpportunity=true`
- Added `tag_type_ids` column (JSON) - stores list of ServiceTitan tag type IDs for the job

**2. Supabase Migration Applied**
```sql
ALTER TABLE tickets_raw
ADD COLUMN IF NOT EXISTS is_opportunity BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tag_type_ids JSONB;
```

**3. ServiceTitan API Updates** (`app/servicetitan.py`)
- Added `get_tag_type()` method - fetches tag type details including `isConversionOpportunity` flag
- Added `check_tags_for_opportunity()` method - checks if any tag has `isConversionOpportunity=true`
- Updated `enrich_job_data()` to check job tags and set `is_opportunity` flag

**4. Webhook Updates** (`app/webhook.py`)
- Both `process_webhook()` and `manual_add_job()` now store `is_opportunity` and `tag_type_ids`

**5. UI Updates**

*Queue Page* (`templates/queue.html`):
- Shows 🎯 opportunity indicator badge next to job type for opportunity jobs
- Tooltip: "Conversion Opportunity - Estimates Expected"

*Debrief Page* (`templates/debrief.html`):
- Shows "🎯 Opportunity" badge in job header if `is_opportunity=true`
- Estimates section highlighted with gold ring for opportunity jobs
- Label shows "🎯 OPPORTUNITY JOB - Estimates Expected" when applicable

### Files Modified
| File | Change |
|------|--------|
| `app/database.py` | Added `is_opportunity`, `tag_type_ids` to TicketRaw |
| `app/servicetitan.py` | Added tag type methods, opportunity detection in enrich_job_data |
| `app/webhook.py` | Store new fields when creating tickets |
| `templates/queue.html` | Show opportunity badge in job list |
| `templates/debrief.html` | Show opportunity badge, highlight estimates section |

### How Opportunity Detection Works
ServiceTitan has "tag types" that can be marked as conversion opportunities (Settings > Tag Types).
When a job has any tag with `isConversionOpportunity: true`, that job is flagged as an opportunity.

**Business Logic:**
- Opportunity jobs should have estimates presented
- If `is_opportunity=true` and `estimate_count=0`, that's a missed opportunity
- The Estimates section on the debrief form is highlighted for opportunity jobs

### Notes
- Only NEW jobs (via webhook or sync) will have `is_opportunity` populated
- To backfill existing jobs, re-sync them from ServiceTitan
- The opportunity flag helps dispatchers focus on jobs where estimates matter most

---

## 2026-01-04 - Session: Dashboard Materials Card & Spot Check Enhancements

### Changes Made

**1. Dashboard Materials Card** (`templates/dashboard.html`)
- Added 6th card "Materials" (💰) to Performance by Trade section
- Tracks materials_on_invoice_rate by trade (HVAC vs Plumbing)
- Critical for gross margin tracking
- Updated grid from 5 to 6 columns

**2. Spot Check Button on Completed Debriefs** (`templates/debrief.html`, `app/main.py`)
- Added "+ Spot Check" button in job header for completed debriefs
- Button visible when viewing any debriefed job from history
- Creates manual spot check and redirects to review form
- Shows "View Spot Check" if one already exists

**3. Spot Check Button in History** (`templates/history.html`)
- Added "+ SC" button column to job history table
- Allows managers to add any job to spot check queue
- Shows "✓ SC" if spot check already exists

### Files Modified
| File | Change |
|------|--------|
| `templates/dashboard.html` | Added Materials card, 6-column grid |
| `templates/debrief.html` | Added spot check button in header |
| `templates/history.html` | Added spot check button column |
| `app/main.py` | Pass spot_check to debrief template, add debrief_session_id/has_spot_check to history API |

---

## 2026-01-04 - Session: Queue Status Management & Auth

### Changes Made

**1. Job Status Behavior Fix**
- Removed auto-status change when viewing a debrief page
- Previously: Opening a job automatically changed it from "pending" to "in_progress"
- Now: Status only changes when the debrief form is actually submitted

**2. Reset Status Feature**
- Added `POST /api/job/{job_id}/reset-status` endpoint to return jobs to pending
- Added "↩ Reset" button on each In Progress job in the queue page
- Button allows dispatchers to return accidentally opened jobs back to pending queue

**3. Lightweight Opportunity Backfill Endpoint**
- Added `POST /api/update-opportunities?limit=200` endpoint
- Only fetches job data (1 API call per ticket) to update `is_opportunity` field
- Much faster than `/api/re-enrich` which makes 3+ calls per ticket for photos/forms
- Reverted `/api/re-enrich` to only handle photo/form counts (original behavior)

**4. Google OAuth Authentication** (user-added)
- Added Google OAuth login with `@christmasair.com` domain restriction
- Added user management admin page (`/admin/users`)
- Added role-based access control (dispatcher, manager, admin, owner)
- All pages now require authentication

**5. Spot Check System** (user-added)
- Added `SpotCheck` model for manager reviews of dispatcher debriefs
- Added spot check queue, form, and history pages
- Selection criteria: flagged jobs, follow-ups, random sampling

**6. Materials on Invoice Check** (user-added)
- Added `materials_on_invoice` field to DebriefSession
- Critical for gross margin tracking - asks if tech added all materials to invoice

### Files Modified
| File | Change |
|------|--------|
| `app/main.py` | Removed auto-status change, added reset endpoint, added update-opportunities endpoint, added auth |
| `app/auth.py` | New file - Google OAuth handlers |
| `app/spot_check.py` | New file - Spot check selection logic |
| `app/database.py` | Added SpotCheck model, DispatcherRole enum, materials_on_invoice field |
| `templates/queue.html` | Added reset button for in_progress jobs, resetJobStatus() function |
| `templates/login.html` | New file - Login page |
| `templates/admin_users.html` | New file - User management |
| `templates/spot_checks.html` | New file - Spot check queue |
| `templates/spot_check_form.html` | New file - Spot check review form |

### API Endpoints Added
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/job/{job_id}/reset-status` | Return job to pending status |
| POST | `/api/update-opportunities` | Lightweight opportunity field backfill |
| GET | `/login` | Login page |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Handle OAuth callback |
| GET | `/logout` | Clear session |
| GET | `/admin/users` | User management (admin only) |
| GET | `/spot-checks` | Spot check queue |
| POST | `/api/spot-checks/select-daily` | Trigger daily spot check selection |

---

## Session Notes Template

When starting a new session, copy this template:

```
## YYYY-MM-DD - Session: [Brief Description]

### Changes Made
-

### Files Modified
-

### Database Changes
-

### Notes/TODOs
-
```
