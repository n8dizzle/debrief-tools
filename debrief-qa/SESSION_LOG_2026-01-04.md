# Session Log - January 4, 2026

## Summary
Connected debrief-qa app to Supabase PostgreSQL and built YTD job import script.

---

## Completed Tasks

### 1. Supabase Database Setup
- **Project created:** `debrief-qa` (Project ID: `dgnsvheokdubqmdlanua`)
- **Region:** us-east-1
- **Database password:** `Christmasair2026!!`
- **Connection string:**
  ```
  postgresql://postgres:Christmasair2026%21%21@db.dgnsvheokdubqmdlanua.supabase.co:5432/postgres
  ```
- **IPv4 add-on:** Enabled ($4/mo) - required for local network connectivity

### 2. Database Schema (via migration)
Tables created:
- `tickets_raw` - Job data from ServiceTitan
- `dispatchers` - Dispatcher accounts
- `debrief_sessions` - Completed debrief records
- `webhook_logs` - Webhook history

Enums:
- `ticket_status` (pending, in_progress, completed)
- `check_status` (pending, pass, fail, na)

### 3. Bulk Import Script Created
**File:** `scripts/import_ytd_jobs.py`

Usage:
```bash
python scripts/import_ytd_jobs.py                 # All of 2025 (YTD)
python scripts/import_ytd_jobs.py --days 30       # Last 30 days
python scripts/import_ytd_jobs.py --days 7        # Last 7 days
python scripts/import_ytd_jobs.py --dry-run       # Preview without importing
python scripts/import_ytd_jobs.py --start 2025-01-01 --end 2025-06-30  # Date range
```

### 4. Data Imported
- **140 jobs** imported (last 7 days)
- 136 pending debrief this week
- 38 pending debrief this month

---

## Files Modified

| File | Change |
|------|--------|
| `.env` | Updated DATABASE_URL to Supabase PostgreSQL |
| `app/database.py` | Fixed SQLEnum to use lowercase values for PostgreSQL compatibility |
| `app/servicetitan.py` | Added `get_completed_jobs()` method for bulk fetching |
| `scripts/import_ytd_jobs.py` | **NEW** - Bulk import script |
| `requirements.txt` | Added `psycopg2-binary==2.9.9` |

---

## Environment Variables (.env)

```bash
# ServiceTitan API (unchanged)
ST_CLIENT_ID=cid.id52p1bf03y336mmge840en5l
ST_CLIENT_SECRET=cs1.8jckmgn897lx9qr4ruw9jg185ujh62zi1v9fkjnjnqtom0zdqw
ST_TENANT_ID=1045848487
ST_APP_KEY=ak1.fscoe5xled3zhbbzcnxjeimyx

# Database (NOW USING SUPABASE)
DATABASE_URL=postgresql://postgres:Christmasair2026%21%21@db.dgnsvheokdubqmdlanua.supabase.co:5432/postgres

# App Settings
DEBUG=true
BASE_URL=http://localhost:8000
```

---

## Pending / Next Steps

1. **Deploy to production** - Need to choose hosting (Railway, Render, VPS)
2. **Point debrief.christmasair.com** - DNS configuration
3. **Import full YTD** - Run `python scripts/import_ytd_jobs.py` for all 2025 jobs
4. **Set up production env vars** - Same as local but with production BASE_URL

---

## Running the App Locally

```bash
cd ~/Desktop/Web\ Projects/Ticket\ Checker/debrief-qa
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

App URL: http://localhost:8000

---

## Supabase Dashboard Access
- URL: https://supabase.com/dashboard/project/dgnsvheokdubqmdlanua
- Organization: n8dizzle's Org (Pro plan)
