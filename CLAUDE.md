# Claude Code Context - Christmas Air Internal Tools

## Project Overview

This monorepo contains internal tools for Christmas Air Conditioning & Plumbing:

1. **That's a Wrap** (`/debrief-qa`) - LIVE at https://debrief.christmasair.com
2. **Internal Portal** (`/internal-portal`) - Not yet deployed

## Recent Updates (Jan 6, 2025)

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
