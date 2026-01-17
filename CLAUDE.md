# Claude Code Context - Christmas Air Internal Tools

## Project Overview

This monorepo contains internal tools for Christmas Air Conditioning & Plumbing:

1. **That's a Wrap** (`/debrief-qa`) - LIVE at https://debrief.christmasair.com
2. **Internal Portal** (`/internal-portal`) - Not yet deployed

## Recent Updates (Jan 17, 2026)

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

### Internal Portal (internal-portal) - Not Deployed Yet
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

- The repo root contains both projects as subfolders
- Local development runs on localhost:8000 (debrief-qa) and localhost:3000 (internal-portal)
- Always test locally before deploying
- Database is SQLite, stored on server (not in git)

## DNS (Namecheap)
- debrief.christmasair.com -> A record -> 64.225.12.86
- portal.christmasair.com -> Not configured yet

## GitHub
- Private repo: https://github.com/n8dizzle/debrief-tools
- Deploy key configured on droplet for pulls
