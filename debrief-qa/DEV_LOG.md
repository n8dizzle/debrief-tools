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
