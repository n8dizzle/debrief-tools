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
