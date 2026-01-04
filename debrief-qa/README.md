# Debrief QA System

Real-time job ticket quality assurance system for dispatcher debrief workflow.

## Overview

When a technician completes a job in ServiceTitan, this system:
1. Receives a webhook notification (near-instant)
2. Pulls full job details from ST API (invoice, photos, estimates, etc.)
3. Adds job to dispatcher's debrief queue
4. Dispatcher reviews and completes checklist
5. Tracks completion rate for bonus accountability

## Architecture

```
ServiceTitan (job.updated webhook)
        ↓
    FastAPI Backend (DigitalOcean VPS)
        ↓
    SQLite Database
        ↓
    Dispatcher Web UI
```

## Quick Start (Local Development)

```bash
# 1. Clone and setup
cd debrief-qa
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your ServiceTitan credentials

# 3. Initialize database
python -c "from app.database import init_db; init_db()"

# 4. Run the app
uvicorn app.main:app --reload --port 8000

# 5. Open http://localhost:8000
```

## Environment Variables

```
ST_CLIENT_ID=your_client_id
ST_CLIENT_SECRET=your_client_secret
ST_TENANT_ID=your_tenant_id
ST_APP_KEY=your_app_key
WEBHOOK_SECRET=your_webhook_secret
DATABASE_URL=sqlite:///./debrief.db
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/servicetitan` | Receives ST webhook events |
| GET | `/api/queue` | Get pending debrief jobs |
| GET | `/api/job/{job_id}` | Get single job details |
| POST | `/api/job/{job_id}/debrief` | Submit debrief checklist |
| GET | `/api/dashboard` | Completion stats |
| POST | `/api/sync` | Pull completed jobs from ST API |
| POST | `/api/re-enrich` | Re-fetch photo/form counts for existing tickets |

### Sync Endpoint

Pull completed jobs from ServiceTitan for the last N hours:

```bash
# From local machine
curl -X POST "https://debrief.christmasair.com/api/sync?hours_back=24"

# Via SSH (faster for production)
ssh root@64.225.12.86 "curl -s -X POST 'http://localhost:8000/api/sync?hours_back=72'"
```

### Re-Enrich Endpoint

Re-fetch photo and form counts for existing tickets. Useful after fixing API endpoints or to refresh data:

```bash
# Small batch from local machine
curl -X POST "https://debrief.christmasair.com/api/re-enrich?limit=20&force=true"

# Large batch via SSH (avoids timeout)
ssh root@64.225.12.86 "curl -s -X POST 'http://localhost:8000/api/re-enrich?limit=200&force=true'"
```

Parameters:
- `limit` - Max tickets to update (default: 50)
- `status` - Filter by status: pending, in_progress, completed
- `force` - Update all tickets even if values unchanged (default: false)

## Checklist Items

All items required (Pass / Fail / N/A):
- Photos reviewed and acceptable
- Invoice summary explains work clearly (1-10 score)
- Payment collected OR reason documented
- Estimates offered/discussed
- Membership offered
- Google reviews discussed
- Replacement discussed (if aged equipment)
- G3 contact needed

## ServiceTitan API Notes

Important quirks discovered while building this system:

### Photos/Attachments
- **Endpoint**: `forms/v2/tenant/{tenant}/jobs/{jobId}/attachments`
- Photos are stored at the job level via the Forms API, not in the job object itself
- Returns all tech photos including data plates, equipment shots, etc.

### Form Submissions
- **Endpoint**: `forms/v2/tenant/{tenant}/submissions`
- **Bug**: The `jobId` query parameter does NOT filter results properly
- **Workaround**: Fetch all submissions and filter client-side by checking the `owners` array:
  ```python
  # Each submission has owners: [{"type": "Job", "id": 123456}, ...]
  job_submissions = [s for s in all_submissions
                     if any(o.get("type") == "Job" and o.get("id") == job_id
                            for o in s.get("owners", []))]
  ```

### Technician Assignments
- Tech info is NOT on the job object directly
- Must fetch via: `dispatch/v2/tenant/{tenant}/appointment-assignments?appointmentIds={id}`
- Get appointment IDs first from: `jpm/v2/tenant/{tenant}/appointments?jobId={id}`
